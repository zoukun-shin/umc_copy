sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
	"sap/ui/core/date/UI5Date"
], function (Base, formatter, UIComponent, MessageBox, UI5Date) {
    "use strict";

    return Base.extend("fico.zecpartsstats.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zecpartsstats-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zecpartsstats-View"),
                        Calculate: aAllAccessBtns.some(btn => btn.AccessId === "zecpartsstats-Calculate")
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

        onSmartFilterBarInitialized: function (oEvent) {

        },

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameters().bindingParams.filters;
            if (!aFilters) {
                aFilters = [];
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

            if (sEvent === "Calculate") {
                var oSmartFilterBar = this.byId("idSmartFilterBar");
                var aFilters = oSmartFilterBar.getFilters();
                if (!aFilters) {
                    aFilters = [];
                }

                var sCompanyCode = oSmartFilterBar.getFilterData().CompanyCode;
                var sFiscalYear = this.byId("idFiscalYear").getDOMValue();
                var oFiscalPeriod = oSmartFilterBar.getFilterData().FiscalPeriod;
                var sFieldName = '';
                var aAuthorityCompanySet = this.getView().getModel("local").getProperty("/authorityCheck/data/CompanySet");

                if (!sCompanyCode) {
                    sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("CompanyCode");
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("requiredField",[sFieldName]));
                    return;
                }

                if (!sFiscalYear) {
                    sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("FiscalYear");
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("requiredField",[sFieldName]));
                    return;
                }

                if (oFiscalPeriod.items.length === 0 && oFiscalPeriod.ranges.length === 0) {
                    sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("FiscalPeriod");
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("requiredField",[sFieldName]));
                    return;
                }

                if (!aAuthorityCompanySet.some(data => data.CompanyCode === sCompanyCode)) {
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityCompany", [sCompanyCode]));     
                    return;
                }

                var aFiltersData = [], sSign = '', sOperator = '', sValue1 = '',  sValue2 = '';
                aFiltersData.push(
                    {   
                        sign: 'I',  
                        path: 'FiscalYear',
                        sOperator: "EQ",
                        value1: sFiscalYear
                    }
                );

                aFiltersData.push(
                    {   
                        sign: 'I',  
                        path: 'CompanyCode',
                        sOperator: "EQ",
                        value1: sCompanyCode
                    }
                );

                oFiscalPeriod.items.forEach((item) => {
                    aFiltersData.push(
                        {   
                            sign: 'I',  
                            path: 'FiscalPeriod',
                            sOperator: "EQ",
                            value1: item.key
                        }
                    );
                });

                oFiscalPeriod.ranges.forEach((range) => {
                    if(range.exclude) {
                        sSign = 'E';

                    } else {
                        sSign = 'I';
                    }
                    
                    switch (range.operation) {
                        case "Contains":
                        case "EndsWith":
                            sOperator = "CP";
                            sValue1 = range.tokenText;
                            sValue2 = "";
                            break;
                        default:
                            sOperator = range.operation;
                            sValue1 = range.value1;
                            sValue2 = range.value2;
                            break;
                    }

                    aFiltersData.push(
                        {   
                            sign: sSign,  
                            path: 'FiscalPeriod',
                            sOperator: sOperator,
                            value1: sValue1,
                            value2: sValue2
                        }
                    );
                });

                var sTitle;

                switch (sEvent) {
                    case "Calculate":
                        sTitle = this.getView().getModel("i18n").getResourceBundle().getText("Calculate");
                        break;
                    default:
                        break;
                }

                var oRequestData = {
                    filterdata: aFiltersData,
                    user: this._UserInfo.getLastName() + " " + this._UserInfo.getFirstName(),
                }

                MessageBox.confirm(this.getView().getModel("i18n").getResourceBundle().getText("confirmCalculate"), {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._callOData(sEvent, oRequestData);
                        }
                    },
                    dependentOn: this.getView()
                });
            }
        },

        _callOData: function (sEvent, oRequestData) {
            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(oRequestData),
                "RecordUUID": ""
            }, {}));

            try {
                Promise.all(aPromise).then((aContext) => {
                    for (const activeContext of aContext) {
                        var object = activeContext.processLogic;
                        var result = JSON.parse(object.Zzkey);
                        if(result.TYPE === "E") {
                            MessageBox.error(result.MESSAGE);
                        } else {
                            MessageBox.success(this.getView().getModel("i18n").getResourceBundle().getText("doneCalculate"));
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

        onBeforeExport: function (oEvent) {
            var oExcelSettings = oEvent.getParameter("exportSettings");
            var columns = oExcelSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "BillingQuantity": 
                    case "BillingQuantityInBaseUnit": 
                    case "ActualIncome": 
                    case "QuantityInBaseUnit": 
                    case "TotalQty": 
                    case "StandardPrice": 
                    case "StandardPriceAmount": 
                    case "StandardPriceAmountUSD": 
                    case "ExchangeRate": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.textAlign = "End";
                        break;
                    case "CostingDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    default:
                        break;
                }
            });

            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(oExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
