sap.ui.define([
    "../model/formatter",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox"
], function (formatter, Controller, UIComponent, MessageBox) {
    "use strict";

    return Controller.extend("fico.zbalancesheet.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            var that = this;
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
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zbalancesheet-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zbalancesheet-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "zbalancesheet-Print"),
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
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameter("bindingParams").filters;
            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var sCompanyCode = oSmartFilterBar.getFilterData().CompanyCode;
            var aAuthorityCompanySet = this.getView().getModel("local").getProperty("/authorityCheck/data/CompanySet");

            if (!aAuthorityCompanySet.some(data => data.CompanyCode === sCompanyCode)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityCompany", [sCompanyCode]));    

                var oFiltersCompanyCode = aFilters[0].aFilters.find(Filters => Filters.sPath === "CompanyCode");
                if (oFiltersCompanyCode) {
                    oFiltersCompanyCode.oValue1 = '';
                }
            }

            var sFiscalYear = this.byId("idFiscalYear").getDOMValue();
            var oFiscalYear = new sap.ui.model.Filter({
                path: "FiscalYear",
                operator: "EQ",
                value1: sFiscalYear
            });
            aFilters.push(oFiscalYear);
        },

        onPressBtn: function (sEvent) {
            var that = this;
            if (sEvent === "Print") {
                var oTable = this.byId("idTable");
                var oBinding = oTable.getBinding("rows");
                if (!oBinding) {
                    return;
                }
                
                var aContexts = oBinding.getContexts();
                if (aContexts.length === 0) {
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noData"));
                    return;
                }

                var oSmartFilterBar = this.byId("idSmartFilterBar");
                var sCompanyCode = oSmartFilterBar.getFilterData().CompanyCode;
                var sFiscalPeriodFr = oSmartFilterBar.getFilterData().FiscalPeriodFr;
                var sFiscalPeriodTo = oSmartFilterBar.getFilterData().FiscalPeriodTo;
                var sLanguage = oSmartFilterBar.getFilterData().Language;
                var aAuthorityCompanySet = this.getView().getModel("local").getProperty("/authorityCheck/data/CompanySet");

                if (!aAuthorityCompanySet.some(data => data.CompanyCode === sCompanyCode)) {
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityCompany", [sCompanyCode]));     
                    return;
                }

                var items = [];
                aContexts.forEach(oContext => {
                    items.push({
                        CompanyCode: oContext.getObject().CompanyCode,
                        FiscalYear: oContext.getObject().FiscalYear,
                        Code: oContext.getObject().Code,
                        OpeningBalAmt: oContext.getObject().OpeningBalAmt,
                        ClosingBalAmt: oContext.getObject().ClosingBalAmt,
                        FiscalPeriodFr: sFiscalPeriodFr,
                        FiscalPeriodTo: sFiscalPeriodTo,
                        Language: sLanguage
                    });
                });

                var oRequestData = {
                    items: items
                    // user: "P00001",
                    // username: "Xinlei Xu",
                    // datetime: this._getCurrentDateTime()
                }

                that._callOData(sEvent, oRequestData);

            }
        },

        _callOData: function (sEvent, oRequestData) {
            var that = this;
            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(oRequestData),
                "RecordUUID": ""
            }, {}));

            try {
                Promise.all(aPromise).then((aContext) => {
                    for (const activeContext of aContext) {
                        if (sEvent === "Print") {
                            if (activeContext.processLogic.RecordUUID) {
                                var sURL = this.getView().getModel("Print").getServiceUrl() + "PrintRecord(RecordUUID=" + activeContext.processLogic.RecordUUID + ",IsActiveEntity=true)/PDFContent";
                                sap.m.URLHelper.redirect(sURL, true);
                            }
                        } 
                    }
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
    
                });
            } catch (error) {
                MessageBox.error(error);
            }
        },

        _CallODataV2: function (sMethod, sPath, aFilters, mUrlParameter, oRequestData) {
            var that = this;
            var oBusyDialog = new sap.m.BusyDialog();
            oBusyDialog.open();
            return new Promise(function (resolve, reject) {
                var mParameters = {
                    method: sMethod === "READ" ? "GET" : "POST",
                    filters: aFilters,
                    urlParameters: mUrlParameter,
                    success: function (oResponse) {
                        oBusyDialog.close();
                        resolve(oResponse);
                    },
                    error: function (oErr) {
                        oBusyDialog.close();
                        reject(JSON.parse(oErr.responseText));
                    }
                };
                switch (sMethod) {
                    case "READ":
                        that.getView().getModel().read(sPath, mParameters);
                        break;
                    case "CREATE":
                        that.getView().getModel().create(sPath, oRequestData, mParameters);
                        break;
                    case "UPDATE":
                        that.getView().getModel().update(sPath, oRequestData, mParameters);
                        break;
                    case "DELETE":
                        that.getView().getModel().remove(sPath, mParameters);
                        break;
                    case "ACTION":
                        that.getView().getModel().callFunction(sPath, mParameters);
                        break;
                    default:
                        break;
                }
            });
        },

        _getCurrentDateTime: function () {
            var date = new Date();
            var sTime = date.getUTCFullYear().toString() +
                this._pad2(date.getUTCMonth() + 1) +
                this._pad2(date.getUTCDate()) +
                this._pad2(date.getUTCHours()) +
                this._pad2(date.getUTCMinutes()) +
                this._pad2(date.getUTCSeconds());
            return sTime;
        },
        _pad2: function (n) {
            return parseInt(n) < 10 ? "0" + parseInt(n) : n;
        },

        onsMrilterBarInitialized: function (oEvent) {
            var oSmartFilterBar = oEvent.getSource();
            oSmartFilterBar.setFilterData({
      
            });
        },

        // Checkbox Event
        onSelect: function (oEvent) {
           
        },

        // Go Event
        onSearch: function (oEvent) {
           
        },

        onBeforeExport: function (oEvent) {
            var oSettings = oEvent.getParameter("exportSettings");
            var columns = oSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "OpeningBalAmt": 
                    case "ClosingBalAmt": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        break;
                    default:
                        break;
                }
            });
        },
    });
});

