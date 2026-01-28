sap.ui.define([
    "./Base",
    "./ValueHelpDialog",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet"
], function (Base, ValueHelpDialog, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet) {
    "use strict";

    return Base.extend("pp.zpickinglistwowo.controller.Main", {

        ValueHelpDialog: ValueHelpDialog,
        formatter: formatter,

        onInit: function () {
            var that = this;
            this._myBusyDialog = new BusyDialog();
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            // *************************************************
            var oMessageTemplate = new sap.m.MessageItem({
                type: '{type}',
                title: '{title}',
                description: '{description}',
                subtitle: '{subtitle}',
                counter: 1
            });
            this._myMessageView = new sap.m.MessageView({
                showDetailsPageHeader: false,
                itemSelect: function () {
                    oBackButton.setVisible(true);
                },
                items: {
                    path: "/MessageItems",
                    template: oMessageTemplate
                }
            });
            var oBackButton = new sap.m.Button({
                icon: sap.ui.core.IconPool.getIconURI("nav-back"),
                visible: false,
                press: function () {
                    that._myMessageView.navigateBack();
                    oBackButton.setVisible(false);
                }
            });
            this._myMessageDialog = new sap.m.Dialog({
                resizable: true,
                content: this._myMessageView,
                beginButton: new sap.m.Button({
                    press: function () {
                        that._myMessageDialog.close();
                    },
                    text: "{i18n>CloseBtn}"
                }),
                customHeader: new sap.m.Bar({
                    contentLeft: [oBackButton],
                    contentMiddle: [
                        new sap.m.Title({
                            text: "{i18n>Results}",
                            level: "H1"
                        })
                    ]
                }),
                contentHeight: "50%",
                contentWidth: "30%",
                verticalScrolling: false
            });
            // *************************************************
            // this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
            });
            oContextBinding.requestObject().then(function (context) {
                var aAccessBtns = [],
                    aAllAccessBtns = [];
                if (context._AssignRole && context._AssignRole.length > 0) {
                    context._AssignRole.forEach(role => {
                        aAccessBtns.push(role._UserRoleAccessBtn);
                    });
                    aAllAccessBtns = aAccessBtns.flat();
                }
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zpickinglistwo-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zpickinglistwo-View"),
                        Create: aAllAccessBtns.some(btn => btn.AccessId === "zpickinglistwo-Create"),
                        Delete: aAllAccessBtns.some(btn => btn.AccessId === "zpickinglistwo-Delete")
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });
            }.bind(this), function (oError) {
                if (!this.oErrorMessageDialog) {
                    this.oErrorMessageDialog = new sap.m.Dialog({
                        type: sap.m.DialogType.Message,
                        state: "Error",
                        content: new sap.m.Text({
                            text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameter("bindingParams").filters;
            var oNewFilter, aNewFilter = [];

            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var oManufacturingOrder = oSmartFilterBar.getFilterData().ManufacturingOrder;
            var oCreatedDate = oSmartFilterBar.getFilterData().CreatedDate;
            if (!oManufacturingOrder && !oCreatedDate) {
                MessageBox.error(this.getResourceBundle().getText("AtLeastOne"));
                this.removeFilterByPath(aFilters, "Plant");
                return;
            };

            var sPostingStatus = this.byId("idPostingStatusSelect").getSelectedKey();
            if (sPostingStatus) {
                aNewFilter.push(new Filter("PostingStatus", "EQ", sPostingStatus));
            }
            var bIsReport = this.getModel("local").getProperty("/IsReport");
            aNewFilter.push(new Filter("IsReport", "EQ", bIsReport));

            if (aNewFilter.length > 0) {
                oNewFilter = new Filter({
                    filters: aNewFilter,
                    and: true
                });
                aFilters.push(oNewFilter);
            }
        },

        removeFilterByPath: function (aFilters, sPath) {
            for (let i = aFilters.length - 1; i >= 0; i--) {
                let oFilter = aFilters[i];
                if (oFilter.sPath === sPath) {
                    aFilters.splice(i, 1);
                    continue;
                }
                if (oFilter.aFilters && oFilter.aFilters.length) {
                    this.removeFilterByPath(oFilter.aFilters, sPath);
                    if (oFilter.aFilters.length === 0) {
                        aFilters.splice(i, 1);
                    }
                }
            }
        },

        onSearch: function (oEvent) {
            this.getModel().resetChanges();
            this._resetControlState();
        },

        _resetControlState: function () {
            var oControl = this.byId("idStandardListTable");
            var aRows = oControl.getRows();
            aRows.forEach(function (oRow) {
                var aCells = oRow.getCells();
                aCells.forEach(function (oCell) {
                    var sControlId = oCell.getId();
                    if (sControlId.includes('input')) {
                        if (oCell.setValueState && oCell.setValueStateText) {
                            oCell.setValueState("None");
                            oCell.setValueStateText("");
                        }
                    }
                });
            });
        },

        onPressBtn: function (sEvent) {
            var that = this;
            this._oTable = this.byId("idStandardListTable");
            var aSelectedItems = this._oTable.getSelectedIndices();
            var iLen = aSelectedItems.length;
            var sTitle, sTitleVariable;
            var aItems = [];
            var aMessageItems = [];
            if (!iLen) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            while (iLen--) {
                var sPath = this._oTable.getContextByIndex(aSelectedItems[iLen]).getPath();
                var oRow = this.getModel().getObject(sPath);
                aItems.push(oRow);
            }
            switch (sEvent) {
                case "CREATE":
                    sTitleVariable = this.getModel("i18n").getResourceBundle().getText("Create");
                    break;
                case "DELETE":
                    sTitleVariable = this.getModel("i18n").getResourceBundle().getText("Delete");
                    break;
                default:
                    break;
            }
            if (sEvent === "CREATE") {
                for (let index = 0; index < aItems.length; index++) {
                    const element = aItems[index];
                    if (!element.StorageLocationFrom) {
                        // 行 {0} {1}を入力してください。
                        aMessageItems.push({
                            type: "Error",
                            title: this.getModel("i18n").getResourceBundle().getText("Error"),
                            description: this.getModel("i18n").getResourceBundle().getText("Message1", [element.RowNo, this.getModel("i18n").getResourceBundle().getText("StorageLocationFrom")]),
                            subtitle: this.getModel("i18n").getResourceBundle().getText("Message1", [element.RowNo, this.getModel("i18n").getResourceBundle().getText("StorageLocationFrom")])
                        });
                    }
                }
            }
            var obj = aMessageItems.find(item => item.type === "Error");
            if (obj) {
                this.showMessageDialog(aMessageItems);
                return;
            }
            var oRequestData = {
                items: aItems,
                user: this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail(),
                username: this._UserInfo.getLastName() + " " + this._UserInfo.getFirstName(),
                datetime: this.getCurrentUTCDateTime()
            }
            sTitle = this.getModel("i18n").getResourceBundle().getText("ConfirmMessage", [sTitleVariable]);
            MessageBox.confirm(sTitle, {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Event": sEvent,
                            "Zzkey": JSON.stringify(oRequestData),
                            "RecordUUID": ""
                        }, {}).then(function (oResponse) {
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            result.MESSAGEITEMS.forEach(element => {
                                aMessageItems.push({
                                    type: element.TYPE,
                                    title: element.TITLE,
                                    description: element.DESCRIPTION,
                                    subtitle: element.SUBTITLE
                                });
                            });
                            that.showMessageDialog(aMessageItems);
                            that._oTable.clearSelection();
                            that.getModel().resetChanges();
                            that.getModel().refresh();
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
            this.showMessageDialog(aMessageItems);
        },

        showMessageDialog: function (aMessageItems) {
            if (aMessageItems.length > 0) {
                this.getModel("local").setProperty("/MessageItems", aMessageItems);
                this._myMessageView.setModel(this.getModel("local"));
                this._myMessageView.navigateBack();
                this.getView().addDependent(this._myMessageDialog);
                this._myMessageDialog.open();
            }
        },

        handleChange: function (oEvent) {
            var sValue, sInputBindingPath, sODataPath, sPath;
            this._oControl = oEvent.getSource();
            var sRowBindingPath = this._oControl.getParent().getBindingContext().getPath();
            switch (this._oControl.getMetadata().getName()) {
                case "sap.m.Input":
                    sValue = this._oControl.getValue();
                    sInputBindingPath = this._oControl.mBindingInfos.value.parts[0].path;
                    sODataPath = this._oControl.mBindingInfos.suggestionRows.path;
                    break;
                case "sap.m.ComboBox":
                    sValue = this._oControl.getSelectedKey();
                    sInputBindingPath = this._oControl.mBindingInfos.selectedKey.parts[0].path;
                    sODataPath = this._oControl.mBindingInfos.items.path;
                    break;
                default:
                    break;
            }
            // this._oControl.setValueState("Error");
            this.getModel().setProperty(sRowBindingPath + "/StorageLocationFromState", "Error");
            sPath = sODataPath + "('" + sValue + "')";

            //----------------------------Custom Logic----------------------------------------
            if (sODataPath === "/ZC_MaterialStockVH") {
                var sMaterial = this.getModel().getProperty(sRowBindingPath + "/Material");
                var sPlant = this.getModel().getProperty(sRowBindingPath + "/Plant");
                sPath = sODataPath + "(Material='" + sMaterial + "',Plant='" + sPlant + "',StorageLocation='" + sValue + "')";
            }
            var sBindFieldName = sInputBindingPath;
            var aFilters = [];
            aFilters.push(new Filter("Material", FilterOperator.EQ, sMaterial));
            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            aFilters.push(new Filter("StorageLocation", FilterOperator.EQ, sValue));
            this._CallODataV2("READ", sODataPath, aFilters, {}, {}).then(function (oResponse) {
                if (oResponse.results.length > 0) {
                    // this._oControl.setValueState("None");
                    this.getModel().setProperty(sRowBindingPath + "/StorageLocationFromState", "None");
                    if (sODataPath === "/ZC_MaterialStockVH") {
                        this.getModel().setProperty(sRowBindingPath + "/" + sBindFieldName, oResponse.results[0]["StorageLocation"]);
                        this.getModel().setProperty(sRowBindingPath + "/" + sBindFieldName + "Name", oResponse.results[0]["StorageLocationName"]);
                        this.getModel().setProperty(sRowBindingPath + "/" + sBindFieldName + "Stock", oResponse.results[0]["StockQuantity"]);
                    }
                }
            }.bind(this), function (oError) {
                if (sODataPath === "/ZC_MaterialStockVH") {
                    this.getModel().setProperty(sRowBindingPath + "/" + sBindFieldName + "Name", "");
                    this.getModel().setProperty(sRowBindingPath + "/" + sBindFieldName + "Stock", 0);
                }
            }.bind(this));
            //----------------------------Custom Logic----------------------------------------

            if (!sValue) {
                // this._oControl.setValueState("None");
                this.getModel().setProperty(sRowBindingPath + "/StorageLocationFromState", "None");
            }
        },

        handleSuggest: function (oEvent) {
            var aFilters = [];
            var oRowData = this.getModel().getProperty(oEvent.getSource().getParent().getBindingContext().getPath());
            aFilters.push(new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.EQ, oRowData.Plant));
            aFilters.push(new sap.ui.model.Filter("Material", sap.ui.model.FilterOperator.EQ, oRowData.Material));
            oEvent.getSource().getBinding("suggestionRows").filter(aFilters);
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
                    case "RequisitionDate":
                    case "CreatedDate":
                    case "DeletedDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    //  Time
                    case "CreatedTime":
                    case "DeletedTime":
                        oColumn.type = sap.ui.export.EdmType.Time;
                        oColumn.utc = false;
                        break;
                    case "StorageLocationFromStock":
                    case "RequiredQuantity":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        oColumn.unitProperty = "BaseUnit";
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
