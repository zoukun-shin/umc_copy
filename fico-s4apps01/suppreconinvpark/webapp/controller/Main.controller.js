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
            this.getModel("local").setProperty("/draftEdits", {});
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

        onDraftFieldChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext();
            if (!oContext) {
                return;
            }

            var oBindingInfo = oSource.getBindingInfo("value");
            var sFieldName = oBindingInfo && oBindingInfo.parts && oBindingInfo.parts[0] && oBindingInfo.parts[0].path;
            if (!sFieldName) {
                return;
            }

            var vValue;
            // For InvoiceDate (DatePicker), store the Date object so that
            // writing it back to the OData model (which has type:'sap.ui.model.type.Date')
            // works correctly and the displayed value is not cleared.
            if (sFieldName === "InvoiceDate" && typeof oSource.getDateValue === "function") {
                vValue = oEvent.getParameter("dateValue");
                if (vValue === undefined) {
                    vValue = oSource.getDateValue();
                }
            } else {
                vValue = oEvent.getParameter("value");
                if (vValue === undefined && typeof oSource.getValue === "function") {
                    vValue = oSource.getValue();
                }
            }

            this._setDraftFieldValue(oContext, sFieldName, vValue);
        },

        onSaveDraft: function () {
            this._syncActiveEditorValue();

            var oLocalModel = this.getModel("local");
            var oMainModel = this.getModel();
            var oDraftEdits = oLocalModel.getProperty("/draftEdits") || {};
            var aDraftKeys = Object.keys(oDraftEdits);

            if (aDraftKeys.length === 0) {
                MessageToast.show(this.getResourceBundle().getText("noDraftChanges"));
                return;
            }

            var iSavedRows = 0;
            aDraftKeys.forEach(function (sDraftKey) {
                var oDraftRow = oDraftEdits[sDraftKey];
                var sPath = oDraftRow.__path;
                if (!sPath) {
                    return;
                }

                var bHasSavedField = false;
                ["InvoiceDate", "MIROVendorInvoiceNo", "MIROText", "MIROHeaderText"].forEach(function (sFieldName) {
                    if (oDraftRow[sFieldName] !== undefined) {
                        oMainModel.setProperty(sPath + "/" + sFieldName, oDraftRow[sFieldName]);
                        bHasSavedField = true;
                    }
                });

                if (bHasSavedField) {
                    iSavedRows += 1;
                }
            });

            MessageToast.show(this.getResourceBundle().getText("draftSaved", [iSavedRows]));
        },

        _callOData: function (sEvent) {
            this._syncActiveEditorValue();

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
                    Status: '',
                    Message: '',
                    InvoiceDate: this._getRowFieldValue(oContext, "InvoiceDate"),
                    MIROVendorInvoiceNo: this._getRowFieldValue(oContext, "MIROVendorInvoiceNo"),
                    MIROText: this._getRowFieldValue(oContext, "MIROText"),
                    MIROHeaderText: this._getRowFieldValue(oContext, "MIROHeaderText"),
                    Plant: this._getRowFieldValue(oContext, "Plant"),
                    CompanyCode: this._getRowFieldValue(oContext, "CompanyCode"),
                    MaterialDocumentYear: this._getRowFieldValue(oContext, "MaterialDocumentYear"),
                    MaterialDocument: this._getRowFieldValue(oContext, "MaterialDocument"),
                    MaterialDocumentItem: this._getRowFieldValue(oContext, "MaterialDocumentItem"),
                    TaxCode: this._getRowFieldValue(oContext, "TaxCode"),
                    TaxPriceQualifiedQty: this._getRowFieldValue(oContext, "TaxPriceQualifiedQty"),
                    Vendor: this._getRowFieldValue(oContext, "Vendor"),
                    PurchaseOrderItemCategory: this._getRowFieldValue(oContext, "PurchaseOrderItemCategory"),
                    Currency: this._getRowFieldValue(oContext, "Currency"),
                    POQuantity: this._getRowFieldValue(oContext, "POQuantity"),
                    POUnit: this._getRowFieldValue(oContext, "POUnit"),
                    PurchaseOrder: this._getRowFieldValue(oContext, "PurchaseOrder"),
                    PurchaseOrderItem: this._getRowFieldValue(oContext, "PurchaseOrderItem")

                });
            });

            // Validate required fields before sending to backend
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var aErrors = [];
            var oFirstRowByInvoiceNo = {};

            aRequestData.forEach(function (oRow, iIdx) {
                var iTableRowNum = aSelectedIndices[iIdx] + 1;

                if (!oRow.MIROVendorInvoiceNo) {
                    aErrors.push(oBundle.getText("validationMIROVendorInvoiceNoRequired", [iTableRowNum]));
                } else {
                    if (!oFirstRowByInvoiceNo.hasOwnProperty(oRow.MIROVendorInvoiceNo)) {
                        oFirstRowByInvoiceNo[oRow.MIROVendorInvoiceNo] = iIdx;
                        if (!oRow.InvoiceDate) {
                            aErrors.push(oBundle.getText("validationInvoiceDateRequired", [oRow.MIROVendorInvoiceNo]));
                        }
                        if (!oRow.MIROText) {
                            aErrors.push(oBundle.getText("validationMIROTextRequired", [oRow.MIROVendorInvoiceNo]));
                        }
                        if (!oRow.MIROHeaderText) {
                            aErrors.push(oBundle.getText("validationMIROHeaderTextRequired", [oRow.MIROVendorInvoiceNo]));
                        }
                    }
                }
            });

            if (aErrors.length > 0) {
                MessageBox.error(aErrors.join("\n"));
                return;
            }

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

                                oContext.getModel().setProperty(
                                    oContext.getPath() + "/Status",
                                    oResult.STATUS
                                );

                                oContext.getModel().setProperty(
                                    oContext.getPath() + "/Message",
                                    oResult.MESSAGE
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

            this._BusyDialog.close();
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

        _getRowFieldValue: function (oContext, sFieldName) {
            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            var sDraftKey = this._getDraftRowKey(sPath);
            var oDraftRow = this.getModel("local").getProperty("/draftEdits/" + sDraftKey);
            var oPendingChanges = oModel.getPendingChanges ? oModel.getPendingChanges() : null;
            var sPendingKey = sPath.startsWith("/") ? sPath.substring(1) : sPath;
            var vValue;

            if (oDraftRow && oDraftRow[sFieldName] !== undefined) {
                vValue = oDraftRow[sFieldName];
                return sFieldName === "InvoiceDate" ? this._formatDateForBackend(vValue) : vValue;
            }

            if (oPendingChanges && oPendingChanges[sPendingKey] && oPendingChanges[sPendingKey][sFieldName] !== undefined) {
                vValue = oPendingChanges[sPendingKey][sFieldName];
                return sFieldName === "InvoiceDate" ? this._formatDateForBackend(vValue) : vValue;
            }

            vValue = oModel.getProperty(sPath + "/" + sFieldName);
            return sFieldName === "InvoiceDate" ? this._formatDateForBackend(vValue) : vValue;
        },

        _setDraftFieldValue: function (oContext, sFieldName, vValue) {
            var oLocalModel = this.getModel("local");
            var sPath = oContext.getPath();
            var sDraftKey = this._getDraftRowKey(sPath);

            if (!oLocalModel.getProperty("/draftEdits/" + sDraftKey)) {
                oLocalModel.setProperty("/draftEdits/" + sDraftKey, {
                    __path: sPath
                });
            }
            oLocalModel.setProperty("/draftEdits/" + sDraftKey + "/" + sFieldName, vValue);
        },

        _getDraftRowKey: function (sPath) {
            return encodeURIComponent(sPath.startsWith("/") ? sPath.substring(1) : sPath);
        },

        _formatDateForBackend: function (vDate) {
            if (vDate === null || vDate === undefined || vDate === "") {
                return "";
            }

            if (vDate instanceof Date && !isNaN(vDate.getTime())) {
                return vDate.getFullYear().toString() +
                    this._pad2(vDate.getMonth() + 1) +
                    this._pad2(vDate.getDate());
            }

            if (typeof vDate === "string") {
                var sDate = vDate.trim();
                if (!sDate) {
                    return "";
                }

                if (/^\d{8}$/.test(sDate)) {
                    return sDate;
                }

                var aDateParts = sDate.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
                if (aDateParts) {
                    return aDateParts[1] + this._pad2(aDateParts[2]) + this._pad2(aDateParts[3]);
                }

                var aSapDate = sDate.match(/^\/Date\((\d+)\)\/$/);
                if (aSapDate) {
                    var oSapDate = new Date(parseInt(aSapDate[1], 10));
                    if (!isNaN(oSapDate.getTime())) {
                        return oSapDate.getFullYear().toString() +
                            this._pad2(oSapDate.getMonth() + 1) +
                            this._pad2(oSapDate.getDate());
                    }
                }

                var oIsoDate = new Date(sDate);
                if (!isNaN(oIsoDate.getTime())) {
                    return oIsoDate.getFullYear().toString() +
                        this._pad2(oIsoDate.getMonth() + 1) +
                        this._pad2(oIsoDate.getDate());
                }
            }

            return vDate;
        }
    });
});