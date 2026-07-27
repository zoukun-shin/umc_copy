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

    return Base.extend("fico.suppreconinvpark.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._BusyDialog = new BusyDialog();
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            sEmail = 'xinlei.xu@sh.shin-china.com';
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "suppreconinvpark-View")) {
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
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "suppreconinvpark-Post")
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

        onSearch: function () {
            // Action后，清除前端缓存的数据
            var oBinding = this.byId("idTable").getBinding("rows");
            if (oBinding) {
                oBinding.getContexts().forEach(function(oContext){
                    oContext.getModel().setProperty(
                        oContext.getPath()+"/InvoiceNo",
                        ""
                    );
                    oContext.getModel().setProperty(
                        oContext.getPath()+"/InvoiceYear",
                        ""
                    );
                });
            }
        },

        onBeforeRebindTable: function (oEvent) {
            var oBinding = oEvent.getParameter("bindingParams");
            var aFilters = oBinding.filters;

            var sListType = this.getModel("local").getProperty("/ListType");
			if (sListType) {
				aFilters.push(new Filter("ListType", FilterOperator.EQ, sListType));
			}

            if (!aFilters) {
                aFilters = [];
            }

        },

        onPost: function () {
            this._callOData("Post");
        },

        _callOData: function (sEvent) {
            var oTable = this.byId("idTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noSelectedRows"));
                return;
            }

            var aRequestData = [];
            aSelectedIndices.forEach(iSelectedIndices => {
                var oContext = this.byId("idTable").getContextByIndex(iSelectedIndices);
                aRequestData.push({
                    InvoiceNo: '',
                    InvoiceYear: '',
                    Plant: oContext.getObject().Plant,
                    CompanyCode: oContext.getObject().CompanyCode,
                    MaterialDocumentYear: oContext.getObject().MaterialDocumentYear,
                    MaterialDocument: oContext.getObject().MaterialDocument,
                    MaterialDocumentItem: oContext.getObject().MaterialDocumentItem
                });
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
                    this._BusyDialog.close();
                    for (const activeContext of aContext) {
                        var object = activeContext.processLogic;

                        aSelectedIndices.forEach(iIndices => {
                            var oContext = oTable.getContextByIndex(iIndices);
                            var oRowData = oContext.getObject();

                            var oResult = JSON.parse(object.Zzkey).find(function (item) {
                                return String(item.COMPANYCODE) === String(oRowData.CompanyCode) &&
                                    String(item.MATERIALDOCUMENTYEAR) === String(oRowData.MaterialDocumentYear) &&
                                    String(item.MATERIALDOCUMENT) === String(oRowData.MaterialDocument) &&
                                    String(item.MATERIALDOCUMENTITEM) === String(oRowData.MaterialDocumentItem);
                            });

                            if (oResult) {
                                oContext.getModel().setProperty(
                                    oContext.getPath() + "/InvoiceNo",
                                    oResult.INVOICENO
                                );

                                oContext.getModel().setProperty(
                                    oContext.getPath() + "/InvoiceYear",
                                    oResult.INVOICEYEAR
                                );
                            }
                        });
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

        onExport: function () {
            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding("rows");
            var aExcelSet = oBinding.getContexts().map(function (oContext) {
                return oContext.getObject();
            });
            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, sUnitProperty, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").getBindingPath("text");
                    if (!sFieldName) {
                        sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.state.parts[0].path;
                    }

                    switch (sFieldName) {
                        //  Number 
                        case "POQuantity": 
                        case "NetPrice": 
                        case "PriceUnitPer": 
                        case "POLinePrice": 
                        case "GRQuantity": 
                        case "GRUnitPrice": 
                        case "GRAmount": 
                        case "QualifiedQuantity": 
                        case "UnqualifiedQuantity": 
                        case "InspectionQuantity": 
                        case "ParkedQuantity": 
                        case "ParkedAmount": 
                        case "PostedQuantity": 
                        case "PostedAmount": 
                        case "NotParkedQuantity": 
                        case "NotParkedAmount": 
                        case "TaxPriceQualifiedQty": 
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            sTextAlign = "End";
                            // iScale = 3;
                            // sUnitProperty = "";
                            break;
                        // Date
                        case "DocumentDate":
                        case "MaterialDocumentDate":
                        case "MaterialDocumentEntryDate":
                        case "MaterialDocumentCreationDate":
                        case "TransferDate":
                        case "InvoiceDate":
                        case "PORequiredDeliveryDate":
                            sType = sap.ui.export.EdmType.Date;
                            sTextAlign = "Begin";
                            break;
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            break;
                    }
                    var oExcelCol = {
                        label: sLabelText,
                        type: sType,
                        property: sFieldName,
                        width: parseFloat(aTableCol[i].getWidth()),
                        textAlign: sTextAlign,
                        unitProperty: sUnitProperty,
                        delimiter: bDelimiter,
                        scale: iScale
                    };
                    aExcelCol.push(oExcelCol);
                }
            }
            var oSettings = {
                workbook: {
                    columns: aExcelCol,
                    context: {
                        version: "1.54",
                        hierarchyLevel: "level"
                    }
                },
                dataSource: aExcelSet,
                fileName: this.getModel("i18n").getResourceBundle().getText("appTitle") + "_" + this.getCurrentDateTime() + ".xlsx"
            };
            // Export excel file
            new Spreadsheet(oSettings).build();
        },

        onBeforeExport: function (oEvent) {
            var oExcelSettings = oEvent.getParameter("exportSettings");
            var columns = oExcelSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "POQuantity": 
                    case "NetPrice": 
                    case "PriceUnitPer": 
                    case "POLinePrice": 
                    case "GRQuantity": 
                    case "GRUnitPrice": 
                    case "GRAmount": 
                    case "QualifiedQuantity": 
                    case "UnqualifiedQuantity": 
                    case "InspectionQuantity": 
                    case "ParkedQuantity": 
                    case "ParkedAmount": 
                    case "PostedQuantity": 
                    case "PostedAmount": 
                    case "NotParkedQuantity": 
                    case "NotParkedAmount": 
                    case "TaxPriceQualifiedQty": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.textAlign = "End";
                        break;
                    case "DocumentDate":
                    case "MaterialDocumentDate":
                    case "MaterialDocumentEntryDate":
                    case "MaterialDocumentCreationDate":
                    case "TransferDate":
                    case "InvoiceDate":
                    case "PORequiredDeliveryDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    default:
                        break;
                }
            });

            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this.exportExcel(oExcelSettings, sFileName);
        },

        exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});