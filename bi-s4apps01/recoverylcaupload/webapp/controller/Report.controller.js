sap.ui.define([
    "./Base",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Base, Filter, FilterOperator, BusyDialog, MessageBox, MessageToast) {
    "use strict";

    return Base.extend("bi.recoverylcaupload.controller.Report", {

        onInit() {
            this._BusyDialog = new BusyDialog();
        },

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameter("bindingParams").filters;
            var oNewFilter,
                aNewFilters = [];

            aNewFilters.push(new Filter("UploadType", FilterOperator.EQ, "LCA"));

            var sYearMonth = this.byId("idYearMonth").getValue().split("/").join("");
            if (sYearMonth) {
                aNewFilters.push(new Filter("YearMonth", FilterOperator.EQ, sYearMonth.substring(0, 4) + "0" + sYearMonth.substring(4, 6)));
            }

            if (aNewFilters.length) {
                oNewFilter = new Filter({
                    filters: aNewFilters,
                    and: true
                });
                aFilters.push(oNewFilter);
            }
        },

        onSearch: function () {
            this.getModel().resetChanges();
        },

        onDelete: function () {
            var that = this;
            this._oTable = this.byId("idCustomListTable");
            var aSelectedItems = this._oTable.getSelectedIndices();
            var iLen = aSelectedItems.length;
            var aItems = [];
            if (!iLen) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            while (iLen--) {
                var sPath = this._oTable.getContextByIndex(aSelectedItems[iLen]).getPath();
                var oRow = this.getModel().getObject(sPath);
                aItems.push(oRow);
            }
            var sTitleVariable = this.getModel("i18n").getResourceBundle().getText("Delete");
            var oRequestData = {
                UploadType: "LCA",
                JsonData: aItems
            };
            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("ConfirmMessage", [sTitleVariable]), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Event": "DELETE",
                            "Zzkey": JSON.stringify(oRequestData),
                            "RecordUUID": ""
                        }, {}).then(function (oResponse) {
                            if (oResponse.processLogic.Zzkey) {
                                var result = JSON.parse(oResponse.processLogic.Zzkey);
                            }
                            that._oTable.clearSelection();
                            that.getModel().resetChanges();
                            that.getModel().refresh();
                            MessageToast.show(that.getModel("i18n").getResourceBundle().getText("ProcessingCompleted"));
                        }, function (oError) {
                            var sMsg;
                            if (oError.error.innererror.errordetails.length > 0) {
                                sMsg = oError.error.innererror.errordetails[0].message;
                            } else {
                                sMsg = oError.error.message.value;
                            }
                            MessageBox.error(sMsg);
                        });
                    }
                },
                dependentOn: this.getView()
            });
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  Date
                    case "RecoveryNecessaryAmount":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.textAlign = "End";
                        oColumn.unitProperty = "CompanyCurrency";
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});