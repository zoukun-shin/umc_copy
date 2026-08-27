sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    return {
        parseErrors: function (oError) {
            var messages = "",
                exceptions = [],
                i;
            try {
                var response = JSON.parse(oError.responseText);
                var errordetails = response.error.innererror.errordetails;
                for (i = 0; i < errordetails.length; i++) {
                    if (errordetails[i].target === "exceptions") {
                        exceptions = JSON.parse(errordetails[i].message).EXCEPTIONS;
                        break;
                    }
                }
                if (exceptions.length === 0) {
                    messages = messages + errordetails[errordetails.length - 1].message + "，\n";
                } else {
                    for (i = 0; i < exceptions.length; i++) {
                        messages += (exceptions[i].Message + "，\n");
                    }
                }
            } catch (err) {
                if (oError.statusCode) {
                    messages = oError.statusCode + "：" + oError.statusText + "\n" + oError.message + "，\n";
                } else {
                    messages = oError.message + "，\n";
                }
            } finally {
                return messages.slice(0, messages.length - 2);
            }
        },

        showError: function (sText) {
            MessageBox.error(sText, { styleClass: "sapUiSizeCompact" });
        },

        showWarning: function (sText) {
            MessageBox.warning(sText, { styleClass: "sapUiSizeCompact" });
        },

        showSuccess: function (sText) {
            MessageBox.success(sText, { styleClass: "sapUiSizeCompact" });
        },

        showInformation: function (sText) {
            MessageBox.information(sText, { styleClass: "sapUiSizeCompact" });
        },

        showText: function (sText) {
            MessageToast.show(sText, { width: (sText.length + 2) + "rem" });
        }
    };
});