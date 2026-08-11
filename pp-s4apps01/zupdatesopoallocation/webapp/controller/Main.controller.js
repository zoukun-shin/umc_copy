sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator", 
], function (Base, formatter, BusyDialog, MessageBox, MessageToast, Spreadsheet, Filter, FilterOperator) {
    "use strict";

    return Base.extend("pp.zupdatesopoallocation.controller.Main", {
        formatter: formatter,
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._BusyDialog = new BusyDialog();
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getView().getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zupdatesopoallocation-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getOwnerComponent().getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zupdatesopoallocation-View"),
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "zupdatesopoallocation-Post"),
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
                            text: this.getView().getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));

            this._bindTableToLocalResultSet();
        },

        onSearch: function () {
            var that = this;
            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var aFilters = oSmartFilterBar ? oSmartFilterBar.getFilters() : [];
            this.removeAllColumns();
            that._loadAllData("/SoUpdateAndPoAss", aFilters).then(function (aAllResults) {
                that.getModel("local").setProperty("/resultSet", aAllResults);
                that._bindTableToLocalResultSet();
                that.getModel("local").refresh(true);
            }).catch(function (oError) {
                MessageBox.error(oError.message);
            });
        },

        _bindTableToLocalResultSet: function () {
            var oTable = this.byId("idTable");
            if (!oTable) {
                return;
            }

            oTable.unbindRows();
            oTable.bindRows({
                path: "local>/resultSet"
            });
        },

        removeAllColumns: function () {
            this.getModel("local").setProperty("/resultSet", []);
        },

        onBeforeRebindTable: function (oEvent) {
            var oBinding = oEvent.getParameter("bindingParams");
            var aFilters = oBinding.filters;
            if (!aFilters) {
                aFilters = [];
            }

        },

        onPost: function () {
            this._callOData("Post");
        },

        _callOData: function (sEvent) {
            this._syncActiveEditorValue();

            var aMainData = this.getModel("local").getProperty("/resultSet") || [];
            if (aMainData.length === 0) {
                MessageBox.error("No data to post.");
                return;
            }

            var aRequestData = aMainData.map(function (oRow) {
                return {
                    ResultType: "",
                    Message: "",
                    ProductionOrder: oRow.ProductionOrder,
                    ProcessingType: oRow.ProcessingType,
                    Plant: oRow.Plant,
                    SalesOrder: oRow.SalesOrder,
                    SalesOrderItem: oRow.SalesOrderItem,
                    AssignedQtyAfter: oRow.AssignedQtyAfter
                };
            });

            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(aRequestData),
                "RecordUUID": ""
            }, {}));
            try {
                this._BusyDialog.open();
                Promise.all(aPromise).then((aContext) => {
                    for (const activeContext of aContext) {
                        var object = activeContext.processLogic;

                        var aResults = JSON.parse(object.Zzkey || "[]");
                        var mResultByKey = {};
                        aResults.forEach(function (oItem) {
                            var sKey = [
                                String(oItem.PRODUCTIONORDER),
                                String(oItem.PROCESSINGTYPE),
                                String(oItem.PLANT),
                                String(oItem.SALESORDER),
                                String(oItem.SALESORDERITEM)
                            ].join("|");
                            mResultByKey[sKey] = oItem;
                        });

                        var aUpdatedData = aMainData.map(function (oRow) {
                            var sKey = [
                                String(oRow.ProductionOrder),
                                String(oRow.ProcessingType),
                                String(oRow.Plant),
                                String(oRow.SalesOrder),
                                String(oRow.SalesOrderItem)
                            ].join("|");
                            var oResult = mResultByKey[sKey];

                            if (oResult) {
                                return Object.assign({}, oRow, {
                                    ResultType: oResult.RESULTTYPE,
                                    Message: oResult.MESSAGE
                                });
                            }

                            return oRow;
                        });

                        this.getModel("local").setProperty("/resultSet", aUpdatedData);
                        this._bindTableToLocalResultSet();
                        this.getModel("local").refresh(true);
                        sap.ui.getCore().applyChanges();
                    }
                    MessageToast.show(this.getModel("i18n").getResourceBundle().getText("ProcessingCompleted"));
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    this._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                this._BusyDialog.close();
            }
        },

        _getRowFieldValue: function (oContext, sFieldName) {
            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            var oPendingChanges = oModel.getPendingChanges ? oModel.getPendingChanges() : null;
            var sPendingKey = sPath.startsWith("/") ? sPath.substring(1) : sPath;
            var vValue;

            vValue = oModel.getProperty(sPath + "/" + sFieldName);
            return sFieldName === "InvoiceDate" ? this._formatDateForBackend(vValue) : vValue;
        },
        _syncActiveEditorValue: function () {
            var oActiveElement = document.activeElement;
            if (!oActiveElement || !oActiveElement.id) {
                return;
            }

            var oControl = sap.ui.getCore().byId(oActiveElement.id);
            if (!oControl) {
                return;
            }

            if (typeof oControl.fireChange === "function" && typeof oControl.getValue === "function") {
                oControl.fireChange({
                    value: oControl.getValue()
                });
            }

            sap.ui.getCore().applyChanges();
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
                    // case "ValidityEndDate":
                    // case "CreationDate":
                    //     oColumn.type = sap.ui.export.EdmType.Date;
                    //     break;
                    // case "LastChangeDateTime":
                    //     oColumn.type = sap.ui.export.EdmType.DateTime;
                    //     break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }


    });
});

