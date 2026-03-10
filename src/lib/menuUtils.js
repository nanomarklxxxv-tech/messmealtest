import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, appId } from './firebase';

/**
/**
 * Clean cell text and identify (NV) tags.
 */
const cleanItemXLSX = (item) => {
    if (!item) return null;
    let cleaned = String(item).trim().replace(/^,+|,+$/g, '').trim();
    if (!cleaned) return null;
    return cleaned;
};

/**
 * Parses XLSX files according to the specific structure:
 * - Row 1: Title (skip)
 * - Row 2: Headers (skip)
 * - Row 3+: Days grouped by non-empty Col A
 */
export const parseMenuXLSX = (file, selectedMonth, selectedYear) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = xlsx.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to array of arrays
                const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

                const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
                const finalMenu = {
                    month: `${monthName} ${selectedYear}`,
                    year: selectedYear,
                    monthNum: selectedMonth,
                    days: []
                };

                let currentDayObj = null;

                // Start from row 2 (index 2) skipping Title (0) and Headers (1)
                for (let i = 2; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const colA = row[0] ? String(row[0]).trim() : '';

                    // Stop if footer found
                    if (colA.toUpperCase().includes("MESS SERVICE INSTRUCTIONS") ||
                        colA.toUpperCase().includes("NOTE:")) {
                        break;
                    }

                    // If Col A has text, start a new day group
                    if (colA !== '') {
                        if (currentDayObj) {
                            finalMenu.days.push(currentDayObj);
                        }

                        // Parse "Sun   1,15,29" -> dayAbbr: "Sun", dates: [1,15,29]
                        const dateLabel = colA;
                        const dayAbbrMatch = dateLabel.match(/[a-zA-Z]+/);
                        const dayAbbr = dayAbbrMatch ? dayAbbrMatch[0] : '';

                        const dayNumbers = dateLabel.match(/\d+/g);
                        const datesArray = dayNumbers ? dayNumbers.map(d => parseInt(d)) : [];

                        currentDayObj = {
                            dateLabel,
                            dayAbbr,
                            dates: datesArray,
                            breakfast: [],
                            lunch: [],
                            snacks: [],
                            dinner: []
                        };
                    }

                    if (!currentDayObj) continue;

                    // Collect meals
                    const b = cleanItemXLSX(row[1]);
                    const l = cleanItemXLSX(row[2]);
                    const s = cleanItemXLSX(row[3]);
                    const d = cleanItemXLSX(row[4]);

                    if (b) currentDayObj.breakfast.push(b);
                    if (l) currentDayObj.lunch.push(l);
                    if (s) currentDayObj.snacks.push(s);
                    if (d) currentDayObj.dinner.push(d);
                }

                // Push the last day group object
                if (currentDayObj) {
                    finalMenu.days.push(currentDayObj);
                }

                resolve(finalMenu);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Uploads the monthly parsed menu object to Firestore.
 * Document ID format: HOSTEL_MESSTYPE_YEAR_MONTH
 * Example: MENS_VEG_2026_2
 */
export const uploadMenuBatch = async (processedMenu, targets, messTypes, userId) => {
    const batch = writeBatch(db);
    let count = 0;

    const types = Array.isArray(messTypes) ? messTypes : [messTypes];

    targets.forEach(hostel => {
        types.forEach(messType => {
            const docId = `${hostel}_${messType}_${processedMenu.year}_${processedMenu.monthNum}`;
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'menus', docId);

            batch.set(docRef, {
                ...processedMenu,
                hostel,
                messType,
                updatedAt: serverTimestamp(),
                updatedBy: userId
            }, { merge: false }); // Rewrite the entire month document
            count++;
        });
    });

    await batch.commit();
    return count;
};
