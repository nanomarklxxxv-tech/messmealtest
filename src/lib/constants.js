// src/lib/constants.js
import { Coffee, Sun, Moon } from 'lucide-react';

export const INITIAL_SUPER_ADMIN_EMAIL = "messmeal.notifications@gmail.com";
export const SUPER_ADMIN_EMAILS = ["messmeal.notifications@gmail.com", "wardenmh.food@vitap.ac.in"];
export const DEFAULT_TAGLINE = "Made with ❤️ , EAT ON TIME : BE ON TIME";
export const DEFAULT_RATING_WINDOW = 48;

export const ALLOWED_DOMAINS = ['@vitap.ac.in', '@vitapstudent.ac.in', '@vit.ac.in'];
export const WHITELISTED_EMAILS = ['agpram03@gmail.com'];

export const DEFAULT_MEAL_TIMINGS = {
    Breakfast: { start: "07:30", end: "09:00", icon: Coffee },
    Lunch: { start: "12:30", end: "14:15", icon: Sun },
    Snacks: { start: "16:45", end: "18:15", icon: Coffee },
    Dinner: { start: "19:15", end: "20:45", icon: Moon }
};

export const DEFAULT_HOSTELS = [
    "MH-1", "MH-2", "MH-3", "MH-4", "MH-5", "MH-6", "MH-7", "MH-8",
    "LH-1", "LH-2", "LH-3", "LH-4", "LH-5", "LH-6", "LH-7"
];
export const DEFAULT_MESS_TYPES = ["VEG", "NON-VEG", "SPL"];
export const MEAL_ORDER = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export const MEAL_ACCENTS = {
    Breakfast: {
        borderCls: 'border-orange-500/80 dark:border-orange-400/60',
        bgSubtle: 'bg-orange-50/40 dark:bg-orange-950/20',
        iconCls: 'text-orange-600 dark:text-orange-400',
        labelCls: 'bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-100 border border-orange-300 dark:border-orange-500/50',
    },
    Lunch: {
        borderCls: 'border-emerald-500/80 dark:border-emerald-400/60',
        bgSubtle: 'bg-emerald-50/40 dark:bg-emerald-950/20',
        iconCls: 'text-emerald-600 dark:text-emerald-400',
        labelCls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-500/50',
    },
    Snacks: {
        borderCls: 'border-amber-500/80 dark:border-amber-400/60',
        bgSubtle: 'bg-amber-50/40 dark:bg-amber-950/20',
        iconCls: 'text-amber-600 dark:text-amber-400',
        labelCls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-500/50',
    },
    Dinner: {
        borderCls: 'border-indigo-500/80 dark:border-indigo-400/60',
        bgSubtle: 'bg-indigo-50/40 dark:bg-indigo-950/20',
        iconCls: 'text-indigo-600 dark:text-indigo-400',
        labelCls: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-100 border border-indigo-300 dark:border-indigo-500/50',
    },
};

export const COMMITTEE_ROLES = {
    menu_daily: 'Menu & Daily Check Committee',
    quality_hygiene: 'Quality & Hygiene Committee',
    feedback_grievance: 'Student Feedback & Grievance Committee',
    mess_chairman: 'Mess Chairman',
    block_supervisor: 'Block Supervisor',
    mess_attendant: 'Mess Attendants'
};

export const COMMITTEE_CHECKLISTS = {

    menu_daily: {
        monthly: [
            {
                id: 'M-1',
                text: 'Approved monthly menu displayed in mess'
            },
            {
                id: 'M-2',
                text: 'Menu of the day followed by caterer'
            },
            {
                id: 'M-3',
                text: 'Variety and balanced food items provided'
            },
            {
                id: 'M-4',
                text: 'Weekly/special menu items served as scheduled'
            },
            {
                id: 'M-5',
                text: 'Student feedback collected before preparing menu'
            },
            {
                id: 'M-6',
                text: 'Menu improvement suggestions reported'
            },
            {
                id: 'M-7',
                text: 'Adequate variety across the week (avoid repetition)'
            },
            {
                id: 'M-8',
                text: 'Inclusion of regional food varieties'
            },
            {
                id: 'M-9',
                text: 'Menu includes protein sources (dal, pulses, eggs, paneer, etc.)'
            },
            {
                id: 'M-10',
                text: 'Limited deep fried and oily food items'
            },
            {
                id: 'M-11',
                text: 'Popular student food choices considered'
            },
            {
                id: 'M-12',
                text: 'Seasonal vegetables included in the menu'
            }
        ],
        daily: [
            {
                id: 'MM-1',
                text: 'Menu of the day displayed clearly in the mess'
            },
            {
                id: 'MM-2',
                text: 'Food items served exactly as per the approved menu'
            },
            {
                id: 'MM-3',
                text: 'Proper serving of special items (chicken, paneer, egg, milk, sweet etc.)'
            },
            {
                id: 'MM-4',
                text: 'Adequate availability of drinking water during meals'
            },
            {
                id: 'MM-5',
                text: 'Fruits/Salads provided separately as per menu'
            },
            {
                id: 'MM-6',
                text: 'Fresh chutney/Pickle provided'
            },
            {
                id: 'MM-7',
                text: 'No excessive oil or salt in the food'
            },
            {
                id: 'MM-8',
                text: 'Any change in the menu item kept in the notice board'
            },
            {
                id: 'MM-9',
                text: 'Hot Jeera water is provided in the lunch and dinner'
            },
            {
                id: 'MM-10',
                text: 'Hot Kichidi is provided for sick students'
            },
            {
                id: 'MM-11',
                text: 'QR codes for taking feedback from students is displayed clearly in the mess'
            },
            {
                id: 'MM-12',
                text: 'Night canteen menu is provided as per the approved menu'
            },
            {
                id: 'MM-13',
                text: 'Spicy levels are moderate and acceptable'
            }
        ]
    },

    quality_hygiene: {
        daily: [
            {
                id: 'QH-1',
                text: 'Kitchen and dining hall cleanliness maintained'
            },
            {
                id: 'QH-2',
                text: 'Kitchen staff follow personal hygiene (cap, gloves, clean uniform) while handling food'
            },
            {
                id: 'QH-3',
                text: 'Tobacco use, gum-chewing, and eating food not identified by any kitchen staff in food-handling areas'
            },
            {
                id: 'QH-4',
                text: 'Sorting of fruits, vegetables and raw materials done properly'
            },
            {
                id: 'QH-5',
                text: 'Food is fresh and properly cooked'
            },
            {
                id: 'QH-6',
                text: 'Raw materials stored properly'
            },
            {
                id: 'QH-7',
                text: 'Utensils and plates cleaned properly'
            },
            {
                id: 'QH-8',
                text: 'Drinking water and handwash areas maintained under hygienic conditions throughout mess runtime'
            },
            {
                id: 'QH-9',
                text: 'Milk, eggs and other perishables are within expiry date'
            },
            {
                id: 'QH-10',
                text: 'Groceries are of good quality'
            },
            {
                id: 'QH-11',
                text: 'No pests (rats, cockroaches, or flies) found in kitchen — measures to prevent rodent infestation in place'
            },
            {
                id: 'QH-12',
                text: 'Kitchen waste bins covered'
            },
            {
                id: 'QH-13',
                text: 'Dining tables cleaned on time throughout the runtime of mess'
            },
            {
                id: 'QH-14',
                text: 'Plates, glasses and spoons properly washed'
            },
            {
                id: 'QH-15',
                text: 'No artificial colors, MSG (Aji-no-moto), cooking soda, or chilli powder without artificial colors used'
            },
            {
                id: 'QH-16',
                text: 'All Bain-maries are in working condition including common dishes'
            },
            {
                id: 'QH-17',
                text: 'Egg shell collection bins arranged'
            }
        ]
    },

    feedback_grievance: {
        daily: [
            {
                id: 'FG-1',
                text: 'Feedback collected from students during meal time'
            },
            {
                id: 'FG-2',
                text: 'Feedback/grievance register maintained'
            },
            {
                id: 'FG-3',
                text: 'Repeated complaints identified'
            },
            {
                id: 'FG-4',
                text: 'Complaints communicated to Mess Chairman'
            },
            {
                id: 'FG-5',
                text: 'Follow-up taken for grievance resolution'
            },
            {
                id: 'FG-6',
                text: 'Students satisfied with taste and quality of food'
            },
            {
                id: 'FG-7',
                text: 'Student grievances followed up regularly'
            },
            {
                id: 'FG-8',
                text: 'Students satisfied with menu variety'
            },
            {
                id: 'FG-9',
                text: 'Minor issues communicated to Mess Manager/Caterer'
            }
        ]
    },

    mess_chairman: {
        daily: [
            {
                id: 'MC-1',
                text: 'Coordination with all mess committees done'
            },
            {
                id: 'MC-2',
                text: 'Approved menu implemented properly'
            },
            {
                id: 'MC-3',
                text: 'Food quality and hygiene monitored'
            },
            {
                id: 'MC-4',
                text: 'Committee reports reviewed'
            },
            {
                id: 'MC-5',
                text: 'Issues with caterer/supervisor resolved'
            },
            {
                id: 'MC-6',
                text: 'Monthly report submitted to Food Warden'
            }
        ]
    },

    block_supervisor: {
        daily: [
            {
                id: 'BS-1',
                text: 'Mess opened and closed on time'
            },
            {
                id: 'BS-2',
                text: 'Food preparation started on time'
            },
            {
                id: 'BS-3',
                text: 'Dining hall and kitchen cleanliness monitored'
            },
            {
                id: 'BS-4',
                text: 'Operational issues reported'
            },
            {
                id: 'BS-5',
                text: 'Testing of food sample before serving to students'
            },
            {
                id: 'BS-6',
                text: 'Monitoring the records of oil usage in the kitchen'
            },
            {
                id: 'BS-7',
                text: 'Health issues raised if any — monitored and reported promptly'
            },
            {
                id: 'BS-8',
                text: 'Cooking oil not reused more than 3 times'
            },
            {
                id: 'BS-9',
                text: 'RO water gets tested every 10 days'
            },
            {
                id: 'BS-10',
                text: 'Waste disposed regularly'
            },
            {
                id: 'BS-11',
                text: 'Daily production, usage and wastage records maintained'
            },
            {
                id: 'BS-12',
                text: 'Internal audit records maintained'
            },
            {
                id: 'BS-13',
                text: 'Water cooler deep cleaned on alternate days'
            },
            {
                id: 'BS-14',
                text: 'Monitoring of used oil collection'
            },
            {
                id: 'BS-15',
                text: 'Prevention of used oil entering the kitchen drain'
            },
            {
                id: 'BS-16',
                text: 'Drain covers installed and drains cleaned regularly'
            }
        ]
    },

    mess_attendant: {
        daily: [
            {
                id: 'A-1',
                text: 'Mess staff supervised during service'
            },
            {
                id: 'A-2',
                text: 'Queue discipline maintained'
            },
            {
                id: 'A-3',
                text: 'Sufficient quantity of food being served'
            },
            {
                id: 'A-4',
                text: 'Observations shared with the block supervisors'
            },
            {
                id: 'A-5',
                text: 'Food wastage transported properly'
            },
            {
                id: 'A-6',
                text: 'Food items protected from dust, moisture and pests'
            },
            {
                id: 'A-7',
                text: 'Water purification system functioning properly'
            },
            {
                id: 'A-8',
                text: 'Waste bins covered and cleaned regularly'
            }
        ]
    }

};
