sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageToast",
    "../lib/xml-js",
    "../lib/decimal",
    "sap/ui/core/Fragment"
], (Controller, messages, Filter, formatter, BusyDialog, MessageToast, xml, decimal, Fragment) => {
    "use strict";

    return Controller.extend("sd.invoiceprintcn.controller.Main", {
        formatter: formatter,
        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._oPrintModel = this.getOwnerComponent().getModel("Print");
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new sap.m.BusyDialog();
        },
        onBeforeRebindTable: function (oEvent) {
            var oFilter = oEvent.getParameter("bindingParams").filters;
            var oNewFilter, aNewFilter = [];

            oNewFilter = new Filter({
                filters: aNewFilter,
                and: true
            });
            if (aNewFilter.length > 0) {
                oFilter.push(oNewFilter);
            }
        },

        onInvoicePrint: function () {
            this.onOpenPrintDialog("normal");
        },

        onInvoicePrintToyota: function () {
            this.onOpenPrintDialog("toyota");
        },

        onOpenPrintDialog: function (sMode) {
            // 校验选择的行
            var aSelectedData = this.getSelectedRows();
            if (aSelectedData.length === 0) {
                return;
            }
            this._sPrintMode = sMode;

            if (!this._oPrintDialog) {
                var oView = this.getView();
                this._oPrintDialog = Fragment.load({
                    id: oView.getId(),
                    name: "sd.invoiceprintcn.fragment.PrintDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }
            this._oPrintDialog.then(function (oDialog) {
                oDialog.open();
            }.bind(this));
        },

        onPrintDialogClose: function () {
            this.byId("idPrintDialog").close();
        },

        onPrintDialogConfirm: function () {
            //通用
            //CH（通用）、机种合并（通用） 都用YY1_SD052模板
            var aTemplateConfigGeneral = [
                { templateID: "YY1_SD052", expandNav: "to_ItemCH" },
                { templateID: "YY1_SD052", expandNav: "to_ItemCHMerged" },
                { templateID: "YY1_SD052_PACK", expandNav: "to_ItemPACK" },
                { templateID: "YY1_SD052_CD", expandNav: "to_ItemCRED" },
                { templateID: "YY1_SD052_CD", expandNav: "to_ItemCRED" }
            ];
            //丰田
            //CH(丰田)用YY1_SD052模板
            //机种合并（丰田）使用YY1_SD052_MAT模板
            var aTemplateConfigToyota = [
                { templateID: "YY1_SD052", expandNav: "to_ItemCH" },
                { templateID: "YY1_SD052_MAT_T", expandNav: "to_ItemCHMerged" },
                { templateID: "YY1_SD052_PACK", expandNav: "to_ItemPACK" },
                { templateID: "YY1_SD052_CD", expandNav: "to_ItemCRED" },
                { templateID: "YY1_SD052_CD", expandNav: "to_ItemCRED" }
            ];
            var oTemplateGroup = this.byId("idTemplateGroup");
            var iSelectedIndex = oTemplateGroup.getSelectedIndex();
            var bSort = this.byId("idSortCheckBox").getSelected();
            var bOneLine = this.byId("idOneLineCheckBox").getSelected();
            this._sRevNo = this.byId("idVersionInput").getValue();
            var oConfig;
            if (this._sPrintMode === "toyota") {
                oConfig = aTemplateConfigToyota[iSelectedIndex];
            } else {
                oConfig = aTemplateConfigGeneral[iSelectedIndex];
            }

            if (iSelectedIndex === 4) {
                // C/D Note合并：弹出合并编辑弹窗
                this._sPendingTemplateID = oConfig.templateID;
                this._sPendingExpandNav = oConfig.expandNav;
                this.onOpenCreditMergeDialog();
                return;
            }

            this.byId("idPrintDialog").close();
            this.getPrintData(oConfig.templateID, oConfig.expandNav, bSort, bOneLine);
        },

        getPrintData: function (sTemplateID, sExpandNav, bSort, bOneLine) {
            var aSelectedData = this.getSelectedRows();
            if (!aSelectedData || aSelectedData.length === 0) {
                return;
            }

            var that = this;
            var aPrintData = [];

            this._BusyDialog.open();

            var aPromises = aSelectedData.map(function (oRow) {
                var sBillingDocument = oRow.BillingDocument;
                return new Promise(function (resolve, reject) {
                    var sPath = "/InvoicePrint(BillingDocument='" + sBillingDocument + "')";
                    that._oDataModel.read(sPath, {
                        urlParameters: {
                            "$expand": sExpandNav
                        },
                        success: function (oData) {
                            aPrintData.push(oData);
                            resolve();
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises).then(function () {
                that._BusyDialog.close();
                let aPrintContent = that.processPrintData(aPrintData, sExpandNav, sTemplateID, bSort, bOneLine);
                aPrintContent.forEach(function (oContent) {
                    that.getPDF({PrintData: oContent}, sTemplateID);
                });
            }).catch(function (oError) {
                that._BusyDialog.close();
                var sMsg = messages.parseErrors(oError) || that._ResourceBundle.getText("msgPrintError");
                messages.showError(sMsg);
            });

        },

        processPrintData: function (aPrintData, sExpandNav, sTemplateID, bSort, bOneLine) {
            let that = this;
            let aPrintContent = [];
            let sDecimalLength = "";
            var oTemplateGroup = this.byId("idTemplateGroup");
            var iSelectedIndex = oTemplateGroup.getSelectedIndex();
            switch (iSelectedIndex) {
                case 1:
                    sDecimalLength = "4";
                    break;
                default:
                    sDecimalLength = "2";
            }
            aPrintData.forEach(function (oData) {
                aPrintContent.push({
                    PrintMode: that._sPrintMode,
                    DecimalLength: sDecimalLength,
                    RevNo: that._sRevNo || "0",
                    CompanyName: oData.CompanyName,
                    CompanyAddress: oData.CompanyAddress,
                    CompanyTelephone: oData.CompanyTelephone,
                    CompanyFax: oData.CompanyFax,
                    BillToPartyCode: oData.BillToPartyCode,
                    BillToPartyDescription: oData.BillToPartyDescription,
                    BillToPartyAddress: oData.BillToPartyAddress,
                    AttnBillTo: oData.AttnBillTo,
                    TelBillTo: oData.TelBillTo,
                    FaxBillTo: oData.FaxBillTo,
                    DeliveryTo: oData.DeliveryTo,
                    ShipToPartyCode: oData.ShipToPartyCode,
                    ShipToPartyAddress: oData.ShipToPartyAddress,
                    AttnShipTo: oData.AttnShipTo,
                    TelShipTo: oData.TelShipTo,
                    FaxShipTo: oData.FaxShipTo,
                    InvNo: oData.InvNo,
                    InvoiceDate: oData.InvoiceDate,
                    EDTChinaDate: oData.EDTChinaDate,
                    RefNo: oData.RefNo,
                    Saleman: oData.Saleman,
                    Transportation: oData.Transportation,
                    PaymentTerm: oData.PaymentTerm,
                    DeliveryTerm: oData.DeliveryTerm,
                    VehicleNo: oData.VehicleNo,
                    WaybillNo: oData.WaybillNo,
                    to_Items: {results: []}
                });
                var aItems = oData[sExpandNav] ? oData[sExpandNav].results : [];
                // 排序
                if (bSort) {
                    aItems.sort(function (a, b) {
                        var cmp = (a.ItemNo || "").localeCompare(b.ItemNo || "");
                        if (cmp !== 0) { return cmp; }
                        return (a.CustomerPO || "").localeCompare(b.CustomerPO || "");
                    });
                }
                // 合并为一行
                if (bOneLine) {
                    aItems = that._mergeToOneLine(aItems);
                }
                var sCurrency = "";
                var oTotalQty = new Decimal(0);
                var oTotalAmount = new Decimal(0);
                var oTotalNetWeight = new Decimal(0);
                var oTotalGrossWeight = new Decimal(0);
                aItems.forEach(function (oItem, index) {
                    // 共通的字段
                    var oPrintItem = {
                        No: (index + 1).toString(),
                        ItemNo: oItem.ItemNo,
                        Description: oItem.Description,
                        MaterialByCustomer: oItem.MaterialByCustomer,
                        CustomerPO: oItem.CustomerPO,
                        Uom: oItem.Uom,
                        Quantity: oItem.Quantity
                    };
                    // 每个模板特殊的字段
                    if (sExpandNav === "to_ItemCH") {
                        oPrintItem.SoNo = oItem.SoNo;
                        oPrintItem.DnNo = oItem.DnNo;
                        oPrintItem.RemarkItem = oItem.RemarkItem;
                        oPrintItem.UnitPrice = oItem.UnitPrice;
                        oPrintItem.Amount = oItem.Amount;
                    }
                    if (sExpandNav === "to_ItemCHMerged") {
                        oPrintItem.SoNo = oItem.SoNo;
                        oPrintItem.DnNo = oItem.DnNo;
                        oPrintItem.RemarkItem = oItem.RemarkItem;
                        oPrintItem.UnitPrice = oItem.UnitPrice;
                        oPrintItem.Amount = oItem.Amount;
                    }
                    if (sExpandNav === "to_ItemPACK") {
                        oPrintItem.NetWeight = oItem.NetWeight;
                        oPrintItem.GrossWeight = oItem.GrossWeight;
                        oPrintItem.WeightUnit = oItem.WeightUnit;
                        oPrintItem.CtnNo = oItem.CtnNo;
                        oPrintItem.BoxMeasureSize = oItem.BoxMeasureSize;
                        oPrintItem.BoxQty = oItem.BoxQty;
                    }
                    if (sExpandNav === "to_ItemCRED") {
                        oPrintItem.RemarkItem = oItem.RemarkItem;
                        oPrintItem.UnitPrice = oItem.UnitPrice;
                        oPrintItem.Amount = oItem.Amount;
                    }
                    aPrintContent[aPrintContent.length - 1].to_Items.results.push(oPrintItem);
                    // 累加汇总
                    if (!sCurrency && oItem.Currency) { sCurrency = oItem.Currency; }
                    oTotalQty = Decimal.add(oTotalQty, oItem.Quantity || 0);
                    oTotalAmount = Decimal.add(oTotalAmount, oItem.Amount || 0);
                    oTotalNetWeight = Decimal.add(oTotalNetWeight, oItem.NetWeight || 0);
                    oTotalGrossWeight = Decimal.add(oTotalGrossWeight, oItem.GrossWeight || 0);
                });

                // --- 抬头级聚合字段（基于行项目数据）---
                // PackingSize: 去重拼接 BoxMeasureSize*BoxQty
                var oPackingSet = new Set();
                aItems.forEach(function (oItem) {
                    if (oItem.BoxMeasureSize && oItem.BoxQty) {
                        oPackingSet.add(oItem.BoxMeasureSize + "*" + oItem.BoxQty);
                    }
                });
                if (oPackingSet.size > 0) {
                    oContent.PackingSize = Array.from(oPackingSet).join("; ");
                }

                // PackagesGW: SUM(BoxQty * GrossWeight)
                var iTotalBoxQty = 0;
                var oTotalGWCalc = new Decimal(0);
                aItems.forEach(function (oItem) {
                    var iQty = parseInt(oItem.BoxQty) || 0;
                    var fGW  = parseFloat(oItem.GrossWeight) || 0;
                    iTotalBoxQty += iQty;
                    oTotalGWCalc = Decimal.add(oTotalGWCalc, new Decimal(iQty).times(fGW));
                });
                oContent.PackagesGW = iTotalBoxQty + " Packages,GW(Include Pallet):" + oTotalGWCalc.toFixed(2) + " KG";

                // SapPackageInfo: 物料 + 尺寸*数量（每个行项目一行）
                var aPackageLines = [];
                aItems.forEach(function (oItem) {
                    if (oItem.ItemNo && oItem.BoxMeasureSize && oItem.BoxQty) {
                        aPackageLines.push(oItem.ItemNo + " " + oItem.BoxMeasureSize + "*" + oItem.BoxQty);
                    }
                });
                oContent.SapPackageInfo = aPackageLines.join("\n");

                // 按模板ID添加汇总字段
                var oContent = aPrintContent[aPrintContent.length - 1];
                if (sTemplateID === "YY1_SD052_PACK") {
                    oContent.TotalQty = oTotalQty.valueOf();
                    oContent.TotalNetWeight = oTotalNetWeight.valueOf();
                    oContent.TotalGrossWeight = oTotalGrossWeight.valueOf();
                } else {
                    oContent.TotalQty = oTotalQty.valueOf();
                    oContent.Currency = sCurrency;
                    oContent.TotalAmount = oTotalAmount.valueOf();
                }

            });
            return aPrintContent;
        },

        _mergeToOneLine: function (aItems) {
            if (!aItems || aItems.length <= 1) {
                return aItems;
            }
            var oFirst = aItems[0];
            var oMerged = JSON.parse(JSON.stringify(oFirst));
            for (var i = 1; i < aItems.length; i++) {
                oMerged.Quantity = Decimal.add(oMerged.Quantity || 0, aItems[i].Quantity || 0).valueOf();
                oMerged.Amount = Decimal.add(oMerged.Amount || 0, aItems[i].Amount || 0).valueOf();
                oMerged.NetWeight = Decimal.add(oMerged.NetWeight || 0, aItems[i].NetWeight || 0).valueOf();
                oMerged.GrossWeight = Decimal.add(oMerged.GrossWeight || 0, aItems[i].GrossWeight || 0).valueOf();
            }
            return [oMerged];
        },

        onOpenCreditMergeDialog: function () {
            var that = this;
            var aSelectedData = this.getSelectedRows();
            if (aSelectedData.length === 0) {
                return;
            }

            this._BusyDialog.open();
            var aPromises = aSelectedData.map(function (oRow) {
                var sBillingDocument = oRow.BillingDocument;
                return new Promise(function (resolve, reject) {
                    var sPath = "/InvoicePrint(BillingDocument='" + sBillingDocument + "')";
                    that._oDataModel.read(sPath, {
                        urlParameters: {
                            "$expand": "to_ItemCRED"
                        },
                        success: function (oData) {
                            resolve(oData);
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises).then(function (aResults) {
                that._BusyDialog.close();
                // 保存完整打印数据（含头部字段），供 onCreditMergeConfirm 使用
                that._aPendingCreditPrintData = aResults;
                var aMergeItems = [];
                aResults.forEach(function (oData) {
                    var aItems = (oData.to_ItemCRED && oData.to_ItemCRED.results) ? oData.to_ItemCRED.results : [];
                    aItems.forEach(function (oItem) {
                        aMergeItems.push({
                            BillingDocument: oItem.BillingDocument,
                            BillingDocumentItem: oItem.BillingDocumentItem,
                            SoNo: oItem.SoNo,
                            SoItem: oItem.SoItem,
                            ItemNo: oItem.ItemNo,
                            ManagementNo_BDI: oItem.ManagementNo_BDI,
                            MergeNo: "",
                            _raw: oItem
                        });
                    });
                });
                that._LocalData.setProperty("/CredMergeItems", aMergeItems);

                if (!that._oCreditMergeDialog) {
                    var oView = that.getView();
                    that._oCreditMergeDialog = Fragment.load({
                        id: oView.getId(),
                        name: "sd.invoiceprintcn.fragment.CreditNoteMergeDialog",
                        controller: that
                    }).then(function (oDialog) {
                        that.getView().addDependent(oDialog);
                        return oDialog;
                    }.bind(that));
                }
                that._oCreditMergeDialog.then(function (oDialog) {
                    oDialog.open();
                }.bind(that));
            }).catch(function (oError) {
                that._BusyDialog.close();
                var sMsg = messages.parseErrors(oError) || that._ResourceBundle.getText("msgPrintError");
                messages.showError(sMsg);
            });
        },

        onCreditMergeClose: function () {
            this.byId("idCreditMergeDialog").close();
        },

        onCreditMergeConfirm: function () {
            var that = this;
            var aMergeItems = this._LocalData.getProperty("/CredMergeItems");
            if (!aMergeItems || aMergeItems.length === 0) {
                return;
            }

            // 按 MergeNo 分组合并
            var aMergedItems = [];
            var oMergedMap = {};
            aMergeItems.forEach(function (oItem) {
                var sMergeNo = oItem.MergeNo ? oItem.MergeNo.trim() : "";
                if (sMergeNo === "") {
                    // 无合并编号：单独一行
                    aMergedItems.push(oItem._raw);
                } else {
                    if (!oMergedMap[sMergeNo]) {
                        oMergedMap[sMergeNo] = JSON.parse(JSON.stringify(oItem._raw));
                    } else {
                        // 累加数量和金额
                        oMergedMap[sMergeNo].Quantity = Decimal.add(oMergedMap[sMergeNo].Quantity, oItem._raw.Quantity).valueOf();
                        oMergedMap[sMergeNo].Amount = Decimal.add(oMergedMap[sMergeNo].Amount, oItem._raw.Amount).valueOf();
                    }
                }
            });
            for (var sKey in oMergedMap) {
                if (oMergedMap.hasOwnProperty(sKey)) {
                    aMergedItems.push(oMergedMap[sKey]);
                }
            }

            this.byId("idCreditMergeDialog").close();

            var bSort = this.byId("idSortCheckBox").getSelected();
            var bOneLine = this.byId("idOneLineCheckBox").getSelected();

            // 用合并后的行项目替换原始数据中的 to_ItemCRED
            var aPrintData = this._aPendingCreditPrintData || [];
            if (aPrintData.length > 0) {
                aPrintData.forEach(function (oData) {
                    // 清除原始 items，替换为合并后的
                    oData.to_ItemCRED = { results: aMergedItems };
                });
            }

            var aPrintContent = that.processPrintData(aPrintData, "to_ItemCRED", that._sPendingTemplateID, bSort, bOneLine);
            aPrintContent.forEach(function (oContent) {
                that.getPDF({ PrintData: oContent }, that._sPendingTemplateID);
            });
        },

        getPDF: function (pdfContent, sTemplateID) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = this._ResourceBundle.getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = that._oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTemplateID);
                createPrintRecord.setParameter("IsExternalProvidedData", true);
                var oXMLData = json2xml(pdfContent, {
                    compact: true,
                    ignoreComment: true,
                    spaces: 4
                });
                // var pdfData =  btoa(unescape(encodeURIComponent(oXMLData)));
                var pdfData = btoa(unescape(encodeURIComponent("<?xml version=\"1.0\" encoding=\"UTF-8\"?><form>" + oXMLData + "</form>")));
                createPrintRecord.setParameter("ExternalProvidedData", pdfData);
                // var uuidx16 = context.getObject().Uuid.replace(/-/g, '');
                createPrintRecord.setParameter("ProvidedKeys", "");
                createPrintRecord.setParameter("ResultIsActiveEntity", true);
                createPrintRecord.setParameter("FileName", sFileName);
                createPrintRecord.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(createPrintRecord);
                }).catch((oError) => {
                    reject(oError);
                });
            });
            aRecordCreated.push(promise);

            oBusyDialog.open();
            try {
                Promise.all(aRecordCreated).then((aContext) => {
                    oBusyDialog.close();
                    var sURL;
                    for (const activeContext of aContext) {
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        var sPath = that._oPrintModel.getKeyPredicate("/PrintRecord", object);
                        sURL = activeContext.getModel("Print").getServiceUrl() + "PrintRecord" + sPath + '/PDFContent';
                        sap.m.URLHelper.redirect(sURL, true);
                    }
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            }
        },

        getSelectedRows: function () {
            var oSmartTable = this.byId("idSmartTable");
            var oTable = oSmartTable.getTable();

            var aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                messages.showError(this._ResourceBundle.getText("msgNoSelect"));
                return [];
            }

            var oModel = oTable.getModel();
            var aSelectedData = [];

            aSelectedIndices.forEach(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                var oRowData = oModel.getProperty(oContext.getPath());
                aSelectedData.push(JSON.parse(JSON.stringify(oRowData)));
            });

            return aSelectedData;
        },


    });
});
