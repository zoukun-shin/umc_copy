import fioriTools, { rules } from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    ...fioriTools.configs.recommended,
    {
        rules:{
            "breakline-style":"off"
        }
    }
];
