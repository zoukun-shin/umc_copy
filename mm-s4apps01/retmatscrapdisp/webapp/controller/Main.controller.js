sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/VBox",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (Base, formatter, BusyDialog, MessageBox, MessageToast, Dialog, Button, Label, Input, DatePicker, VBox, Spreadsheet, Filter, FilterOperator) {
    "use strict";

    return Base.extend("mm.retmatscrapdisp.controller.Main", {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "retmatscrapdisp-View")) {
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
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "retmatscrapdisp-Post")
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
                oBinding.getContexts().forEach(function (oContext) {
                    oContext.getModel().setProperty(
                        oContext.getPath() + "/Status",
                        ""
                    );
                    oContext.getModel().setProperty(
                        oContext.getPath() + "/Message",
                        ""
                    );
                });
            }
        },

        onBeforeRebindTable: function (oEvent) {
            var oBinding = oEvent.getParameter("bindingParams");
            var aFilters = oBinding.filters;

            var sScrapped = this.getModel("local").getProperty("/Scrapped");
            if (sScrapped) {
                aFilters.push(new Filter("Scrapped", FilterOperator.EQ, sScrapped));
            }

            if (!aFilters) {
                aFilters = [];
            }

        },

        onPost: function () {
            var oTable = this.byId("idTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noSelectedRows"));
                return;
            }

            this._openPostInputDialog();
        },

        _openPostInputDialog: function () {
            var oCostCenterInput = new Input({
                width: "100%"
            });
            var oDocumentDatePicker = new DatePicker({
                width: "100%",
                valueFormat: "yyyyMMdd",
                displayFormat: "yyyy-MM-dd"
            });
            var oPostingDatePicker = new DatePicker({
                width: "100%",
                valueFormat: "yyyyMMdd",
                displayFormat: "yyyy-MM-dd"
            });
            var oGoodsReceiptDatePicker = new DatePicker({
                width: "100%",
                valueFormat: "yyyyMMdd",
                displayFormat: "yyyy-MM-dd"
            });

            var oDialog = new Dialog({
                title: "Post Parameters",
                contentWidth: "26rem",
                content: new VBox({
                    width: "100%",
                    items: [
                        new Label({
                            text: "Cost Center"
                        }),
                        oCostCenterInput,
                        new Label({
                            text: "Document Date"
                        }),
                        oDocumentDatePicker,
                        new Label({
                            text: "Posting Date"
                        }),
                        oPostingDatePicker,
                        new Label({
                            text: "Goods Receipt Date"
                        }),
                        oGoodsReceiptDatePicker
                    ]
                }),
                beginButton: new Button({
                    text: "OK",
                    type: "Emphasized",
                    press: function () {
                        var sCostCenter = oCostCenterInput.getValue().trim();
                        var sDocumentDate = this._formatDateForBackend(oDocumentDatePicker.getDateValue());
                        var sPostingDate = this._formatDateForBackend(oPostingDatePicker.getDateValue());
                        var sGoodsReceiptDate = this._formatDateForBackend(oGoodsReceiptDatePicker.getDateValue());

                        if (!sCostCenter || !sDocumentDate || !sPostingDate || !sGoodsReceiptDate) {
                            MessageBox.error("Please input Cost Center, Document Date, Posting Date and Goods Receipt Date.");
                            return;
                        }

                        oDialog.close();
                        this._callOData("Post", {
                            CostCenter: sCostCenter,
                            DocumentDate: sDocumentDate,
                            PostingDate: sPostingDate,
                            GoodsReceiptDate: sGoodsReceiptDate
                        });
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        },

        _callOData: function (sEvent, oPostInputValues) {

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
                    Status: '',
                    Message: '',
                    Material: oContext.getObject().Material,
                    QuantityInBaseUnit: oContext.getObject().QuantityInBaseUnit,
                    BaseUnit: oContext.getObject().BaseUnit,
                    Plant: oContext.getObject().Plant,
                    PurchaseOrder: oContext.getObject().PurchaseOrder,
                    PurchaseOrderItem: oContext.getObject().PurchaseOrderItem,
                    CostCenter: oPostInputValues ? oPostInputValues.CostCenter : "",
                    DocumentDate: oPostInputValues ? oPostInputValues.DocumentDate : "",
                    PostingDate: oPostInputValues ? oPostInputValues.PostingDate : "",
                    GoodsReceiptDate: oPostInputValues ? oPostInputValues.GoodsReceiptDate : "",
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
                                return String(item.PURCHASEORDER) === String(oRowData.PurchaseOrder) &&
                                    String(item.PURCHASEORDERITEM) === String(oRowData.PurchaseOrderItem);
                            });

                            if (oResult) {
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
                        case "QuantityinBaseUnit":
                        case "PurchaseOrderAmount":
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            sTextAlign = "End";
                            // iScale = 3;
                            // sUnitProperty = "";
                            break;
                        // Date
                        case "DocumentDate551":
                        case "PostingDate":
                        case "DocumentDate":
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
                    case "QuantityinBaseUnit":
                    case "PurchaseOrderAmount":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.textAlign = "End";
                        break;
                    case "DocumentDate551":
                    case "PostingDate":
                    case "DocumentDate":
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

        _formatDateForBackend: function (vDate) {
            if (!vDate) {
                return "";
            }

            if (vDate instanceof Date && !isNaN(vDate.getTime())) {
                return vDate.getFullYear().toString() +
                    this._pad2(vDate.getMonth() + 1) +
                    this._pad2(vDate.getDate());
            }

            return vDate;
        }
    });
});