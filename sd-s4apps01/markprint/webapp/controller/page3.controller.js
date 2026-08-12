sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet",
    "../lib/xml-js",
], (Base, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet, xml) => {
    "use strict";
    var _oFunctions, _ResourceBundle, _oPrintModel;
    return Base.extend("sd.markprint.controller.page3", {
        formatter: formatter,

        onInit() {
            _oFunctions = this;
            var that = this;
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._oDataModel.setRefreshAfterChange(false);
            this._BusyDialog = new BusyDialog();
            if (sap.ushell && sap.ushell.Container) {
                this._UserInfo = sap.ushell.Container.getService("UserInfo").getUser();
            };
        },

        onBeforeRebindTable: function (oEvent) {

            // 根据选择框，添加过滤条件传值到后端
            var filters = oEvent.getParameters().bindingParams.filters;
            if (!filters) {
                filters = [];
            }
        },

        preparePostBody: function () {
            var listItems = this.byId("idAdditionalCustMatSelectionPlugin").getSelectedIndices();
            var selectedRows = [];
            listItems.forEach((item) => {
                var sPath = this.byId("idAdditionalCustMatTable").getContextByIndex(item).getPath();
                var oRow = Object.assign({}, this.getModel().getObject(sPath));
                delete oRow.__metadata;
                selectedRows.push(oRow);
            });
            let postDocs = [JSON.stringify(selectedRows)];
            return postDocs;
        },

        onEdit: function () {
            this._callTableAction("EDIT");
        },

        onDelete: function () {
            this._callTableAction("DELETE");
        },

        _callTableAction: function (sEvent) {
            var aSelectedIndices = this.byId("idAdditionalCustMatSelectionPlugin").getSelectedIndices();
            if (!aSelectedIndices || aSelectedIndices.length === 0) {
                MessageToast.show("Please select at least one row.");
                return;
            }

            var aPostDocs = this.preparePostBody();
            this._BusyDialog.open();

            this._CallODataV2("ACTION", "/processLogic", [], {
                "Zzkey": aPostDocs,
                "Event": sEvent,
                "UserEmail": this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail()
            }, {}).then(function () {
                var sMessageKey = sEvent === "EDIT" ? "editCompleted" : "deleteCompleted";
                this._refreshTable();
                MessageToast.show(this.getModel("i18n").getResourceBundle().getText(sMessageKey));
            }.bind(this)).catch(function (oError) {
                MessageBox.error(oError.message || oError);
            }).finally(function () {
                this._BusyDialog.close();
            }.bind(this));
        },

        _refreshTable: function () {
            var oSmartTable = this.byId("idAdditionalCustMatSmartTable");
            var oSelectionPlugin = this.byId("idAdditionalCustMatSelectionPlugin");
            if (oSelectionPlugin) {
                oSelectionPlugin.clearSelection();
            }
            if (oSmartTable) {
                oSmartTable.rebindTable();
            }
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
                    case "PlannedGoodsIssueDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
