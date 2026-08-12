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
            this._bEditMode = false; // 标记编辑模式状态
            this._aOriginalData = []; // 保存原始数据用于取消操作
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

        onsMrilterBarInitialized: function (oEvent) {
            // SmartFilterBar initialized
        },

        preparePostBody: function () {
            var listItems = this.byId("idAdditionalCustMatSelectionPlugin").getSelectedIndices();
            var selectedRows = [];
            var oTable = this.byId("idAdditionalCustMatTable");
            
            listItems.forEach((item) => {
                var sPath = oTable.getContextByIndex(item).getPath();
                // 获取表格中当前的数据（包括编辑模式的改动）
                var oRow = oTable.getContextByIndex(item).getObject();
                var oData = Object.assign({}, oRow);
                delete oData.__metadata;
                selectedRows.push(oData);
            });
            let postDocs = [JSON.stringify(selectedRows)];
            return postDocs;
        },

        onEdit: function () {
            if (!this._bEditMode) {
                // 进入编辑模式
                var aSelectedIndices = this.byId("idAdditionalCustMatSelectionPlugin").getSelectedIndices();
                if (!aSelectedIndices || aSelectedIndices.length === 0) {
                    MessageToast.show(this.getModel("i18n").getResourceBundle().getText("selectAtLeastOneRowToEdit"));
                    return;
                }

                // 保存原始数据
                this._aOriginalData = [];
                var oTable = this.byId("idAdditionalCustMatTable");
                aSelectedIndices.forEach((index) => {
                    var sPath = oTable.getContextByIndex(index).getPath();
                    this._aOriginalData.push({
                        index: index,
                        data: Object.assign({}, this.getModel().getObject(sPath))
                    });
                });

                // 启用编辑模式
                this._bEditMode = true;
                this._updateTableEditMode(true);
                this._updateButtonsVisibility();
            }
        },

        onSave: function () {
            if (this._bEditMode) {
                // 收集修改的数据
                var aPostDocs = this.preparePostBody();
                this._BusyDialog.open();

                this._CallODataV2("ACTION", "/processLogic", [], {
                    "Zzkey": aPostDocs,
                    "Event": "EDIT",
                    "UserEmail": this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail()
                }, {}).then(function () {
                    this._bEditMode = false;
                    this._updateTableEditMode(false);
                    this._updateButtonsVisibility();
                    this._refreshTable();
                    MessageToast.show(this.getModel("i18n").getResourceBundle().getText("editCompleted"));
                }.bind(this)).catch(function (oError) {
                    MessageBox.error(oError.message || oError);
                }).finally(function () {
                    this._BusyDialog.close();
                }.bind(this));
            }
        },

        _updateTableEditMode: function (bEditMode) {
            var oTable = this.byId("idAdditionalCustMatTable");
            if (!oTable) return;

            var aRows = oTable.getRows();
            aRows.forEach((oRow) => {
                var aCells = oRow.getCells();
                // 跳过前4个只读列（salesorganization, distributionchannel, customer, product）
                // 后续列包含可编辑的Input字段
                for (var i = 4; i < aCells.length; i++) {
                    var oCell = aCells[i];
                    if (oCell.isA("sap.m.Input")) {
                        oCell.setEditable(bEditMode);
                    }
                }
            });
        },

        _updateButtonsVisibility: function () {
            var oEditBtn = this.byId("idEditBtn");
            var oDeleteBtn = this.byId("idDeleteBtn");
            var oSaveBtn = this.byId("idSaveBtn");

            if (this._bEditMode) {
                // 编辑模式下
                if (oEditBtn) oEditBtn.setVisible(false);
                if (oDeleteBtn) oDeleteBtn.setVisible(false);
                if (oSaveBtn) oSaveBtn.setVisible(true);
            } else {
                // 正常模式下
                if (oEditBtn) oEditBtn.setVisible(true);
                if (oDeleteBtn) oDeleteBtn.setVisible(true);
                if (oSaveBtn) oSaveBtn.setVisible(false);
            }
        },

        onDelete: function () {
            var aSelectedIndices = this.byId("idAdditionalCustMatSelectionPlugin").getSelectedIndices();
            if (!aSelectedIndices || aSelectedIndices.length === 0) {
                MessageToast.show(this.getModel("i18n").getResourceBundle().getText("selectAtLeastOneRow"));
                return;
            }

            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("confirmDeleteSelectedRows"), {
                onClose: function(sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aPostDocs = this.preparePostBody();
                        this._BusyDialog.open();

                        this._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": aPostDocs,
                            "Event": "DELETE",
                            "UserEmail": this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail()
                        }, {}).then(function () {
                            this._refreshTable();
                            MessageToast.show(this.getModel("i18n").getResourceBundle().getText("deleteCompleted"));
                        }.bind(this)).catch(function (oError) {
                            MessageBox.error(oError.message || oError);
                        }).finally(function () {
                            this._BusyDialog.close();
                        }.bind(this));
                    }
                }.bind(this)
            });
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
