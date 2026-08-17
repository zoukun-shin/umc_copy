sap.ui.define([
    "./Base",
    "sap/ui/core/UIComponent",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    ".././lib/xml-js",
    "sap/m/plugins/CellSelector",
    "sap/m/plugins/CopyProvider",
    "sap/m/DynamicDateUtil",
    "sap/ui/model/Filter",
    "sap/ui/export/Spreadsheet"
], function (Base, UIComponent, BusyDialog, MessageBox, xml, CellSelector, CopyProvider, DynamicDateUtil, Filter, Spreadsheet) {
    "use strict";

    let oCellSelector;
    let oCopyProvider;
    return Base.extend("pp.zbom.controller.Main", {
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);

            // Cell Copy
            if (window.isSecureContext) {
                const oTable = this.byId("idTable");
                oCellSelector = new CellSelector();
                oTable.addDependent(oCellSelector);

                oCopyProvider = new CopyProvider({ extractData: this.extractData, copy: this.onCopy });
                oTable.addDependent(oCopyProvider);

                const oToolbar = this.byId("idToolBar");
                oToolbar.addContent(oCopyProvider.getCopyButton());
            }
        },

        extractData: function (oRowContext, oColumn) {
            const oValue = oRowContext.getProperty(oColumn.getSortProperty());
            return oColumn.__type ? oColumn.__type.formatValue(oValue, "string") : oValue;
        },

        onCopy: function (oEvent) { },
        
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zbom-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zbom-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "zbom-Print"),
                        PrintVN: aAllAccessBtns.some(btn => btn.AccessId === "zbom-PrintVN"),
                        PrintCN: aAllAccessBtns.some(btn => btn.AccessId === "zbom-PrintCN"),
                        Print2400: aAllAccessBtns.some(btn => btn.AccessId === "zbom-Print2400")
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

        onPrint: function (sEvent) {
            var that = this;
            var aSelectedIndices = this.byId("idTable").getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            } 

            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());
            var oSelected = oTable.getContextByIndex(aSelectedIndices[0]).getObject();
            var HeaderValidityStartDate = oSelected.HeaderValidityStartDate;
            var aItems = that.getItems(oSelected, aAllData);

            var aPromise = that._callOData(sEvent, aItems);
            try {
                Promise.all(aPromise).then((aContext) => {
                    if (aContext.length > 0) {
                        var pdfContent = that.processPrintContent(oSelected, aContext[0].results, HeaderValidityStartDate);
                        that.getPDF(pdfContent, "YY1_BOMPRINT");
                    } 
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                });
            } catch (error) {
                MessageBox.error(error);
            }
        },

        _callOData: function (sEvent, aItems,) {
            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/PrintBom", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(aItems),
                "RecordUUID": ""
            }, {}));

            return aPromise;
        },

        _callProcessLogic: function (sEvent, aItems) {
            return this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(aItems)
            }, {}).then(function (oResponse) {
                var sZzkey = oResponse && oResponse.processLogic ? oResponse.processLogic.Zzkey : "[]";
                return JSON.parse(sZzkey || "[]");
            });
        },

        getItems: function (oSelected, aAllData) {
            var aItems = [];
            if (oSelected) {
                aItems.push({
                    Material: oSelected.Material,
                    BillOfMaterialComponent: oSelected.BillOfMaterialComponent
                });
            }
            return aItems;
        },

        getItems2: function (aFilters) {
            var aItems = [];

            aItems = aFilters.map(item => ({
                path: item.sPath,
                operator: item.sOperator,
                value1: item.oValue1,
                value2: item.oValue2
            }));
            return aItems;
        },

        processPrintContent: function (oSelected, aAllData, HeaderValidityStartDate) {
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };

            var BomPrint = {
                //Head
                Document: aAllData[0].Document,
                ValidfromDate: aAllData[0].ValidfromDate,
                History: aAllData[0].History,
                Revision: aAllData[0].Revision,
                Model: aAllData[0].Model,
                Formula: aAllData[0].Formula,
                Description: aAllData[0].Description,
                Customer: aAllData[0].Customer,
                //Date: 
                to_Item: {
                    results: []
                }
            };

            BomPrint.to_Item.results = aAllData.map(item => ({
                Material: item.Material,
                BOMlevel: item.BOMlevel,
                AltGrp: item.AltGrp,
                FolGrp: item.FolGrp,
                PartNo: item.PartNo,
                PartName: item.PartName,
                Specification: item.Specification,
                MakerPartNo: item.MakerPartNo,
                Boi: item.Boi,
                RefNo: item.RefNo,
                Qty: item.Qty,
                Unit: item.Unit,
                Loc: item.Loc,
                SaftyCERT: item.SaftyCERT,
                ValidPeriod: item.ValidPeriod,
                Sup: item.Sup,
                Remark: item.Remark,
                CustomerPartNo: item.CustomerPartNo,
                RoHS: item.RoHS
            }));

            pdfContent = {
                PrintData: BomPrint
            };

            return pdfContent;
        },

        onPrintVN: function (sEvent) {
            var that = this;
            var aSelectedIndices = this.byId("idTable").getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            }

            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());
            var oSelected = oTable.getContextByIndex(aSelectedIndices[0]).getObject();
            var HeaderValidityStartDate = oSelected.HeaderValidityStartDate;
            var aItems = that.getItems(oSelected, aAllData);

            var aPromise = that._callOData(sEvent, aItems);
            try {
                Promise.all(aPromise).then((aContext) => {
                    if (aContext.length > 0) {
                        var pdfContent = that.processPrintContent(oSelected, aContext[0].results, HeaderValidityStartDate);
                        that.getPDF(pdfContent, "YY1_BOMPRINT_VN");
                    }
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                });
            } catch (error) {
                MessageBox.error(error);
            }
        },

        onPrintCN: function () {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aSelectedIndices = this.byId("idTable").getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            }

            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());
            var oSelected = oTable.getContextByIndex(aSelectedIndices[0]).getObject();
            var HeaderValidityStartDate = oSelected.HeaderValidityStartDate;
            var aItems = that.getItems(oSelected, aAllData);
            var bUse2400AsCNThirdPage = oSelected && oSelected.Plant === "2400";

            var aCNEvents = ["PrintCNStep1", "PrintCNStep2", bUse2400AsCNThirdPage ? "PrintCN2400" : "PrintCNStep3"];
            var aTemplateByStep = ["YY1_BOMPRINT_CO", "YY1_BOMPRINT_CH", bUse2400AsCNThirdPage ? "YY1_BOM_2400" : "YY1_BOMPRINT_CN"];
            var aBuilders = [
                that.processPrintContentCNStep1.bind(that),
                that.processPrintContentCNStep2.bind(that),
                (bUse2400AsCNThirdPage ? that.processPrintContent2400 : that.processPrintContentCNStep3).bind(that)
            ];

            that._openCNDateDialog().then(function (sCNValidPeriod) {
                if (sCNValidPeriod === null) {
                    return;
                }

                oBusyDialog.open();
                return that._runCNPrintStepsSequentially(aCNEvents, aTemplateByStep, aBuilders, oSelected, aItems, HeaderValidityStartDate, sCNValidPeriod).then(function (aRecordUUIDs) {
                    return that._mergeCNAndOpenPdf(aRecordUUIDs);
                }).catch(function (oError) {
                    MessageBox.error(oError.message || JSON.stringify(oError));
                }).finally(function () {
                    oBusyDialog.close();
                });
            });
        },

        onPrint2400: function () {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var sPrint2400Event = "Print2400";
            var sPrint2400TemplateId = "YY1_BOM_2400";
            var aSelectedIndices = this.byId("idTable").getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            }

            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());
            var oSelected = oTable.getContextByIndex(aSelectedIndices[0]).getObject();
            var aItems = that.getItems(oSelected, aAllData);

            oBusyDialog.open();
            return that._callProcessLogic(sPrint2400Event, aItems).then(function (aStepData) {
                var oPdfContent = that.processPrintContent2400(oSelected, aStepData);
                return that._createPrintRecordOnly(oPdfContent, sPrint2400TemplateId);
            }).then(function (sRecordUUID) {
                if (!sRecordUUID) {
                    return Promise.reject(new Error("No print record created for Print2400."));
                }
                return that._fetchPdfAsArrayBuffer(sRecordUUID).then(function (oPdfBuffer) {
                    return that._openPdfFromBuffer(oPdfBuffer);
                });
            }).catch(function (oError) {
                MessageBox.error(oError.message || JSON.stringify(oError));
            }).finally(function () {
                oBusyDialog.close();
            });
        },

        _openCNDateDialog: function () {
            return new Promise(function (resolve) {
                var bResolved = false;
                var oDatePicker = new sap.m.DatePicker({
                    width: "100%",
                    placeholder: "请选择日期",
                    valueFormat: "yyyyMMdd",
                    displayFormat: "yyyy-MM-dd"
                });

                var oDialog = new sap.m.Dialog({
                    title: "CN打印日期",
                    contentWidth: "460px",
                    content: [
                        new sap.m.VBox({
                            items: [
                                oDatePicker,
                                new sap.m.Text({
                                    text: "PS:不指定日期时，封面显示【长期有效】"
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "确定",
                        press: function () {
                            bResolved = true;
                            var sSelectedDate = oDatePicker.getValue();
                            oDialog.close();
                            resolve(sSelectedDate || "长期有效");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "取消",
                        press: function () {
                            bResolved = true;
                            oDialog.close();
                            resolve(null);
                        }
                    }),
                    afterClose: function () {
                        if (!bResolved) {
                            resolve(null);
                        }
                        oDialog.destroy();
                    }
                });

                oDialog.open();
            });
        },

        _runCNPrintStepsSequentially: function (aCNEvents, aTemplateByStep, aBuilders, oSelected, aItems, HeaderValidityStartDate, sCNValidPeriod) {
            var that = this;
            var aRecordUUIDs = [];

            return aCNEvents.reduce(function (oChain, sCNEvent, iIndex) {
                return oChain.then(function () {
                    return that._callProcessLogic(sCNEvent, aItems).then(function (aStepData) {
                        var oPdfContent = aBuilders[iIndex](oSelected, aStepData, HeaderValidityStartDate, sCNValidPeriod);
                        return that._createPrintRecordOnly(oPdfContent, aTemplateByStep[iIndex], iIndex + 1).then(function (sRecordUUID) {
                            aRecordUUIDs.push(sRecordUUID);
                        });
                    });
                });
            }, Promise.resolve()).then(function () {
                return aRecordUUIDs;
            });
        },

        _createPrintRecordOnly: function (pdfContent, sTemplateID, iStepNo) {
            var that = this;
            var sStepSuffix = iStepNo ? ("_STEP" + iStepNo) : "";
            var sFileName = this.getView().getModel("i18n").getResourceBundle().getText("appTitle") + sStepSuffix + "_" + new Date().getTime() + "_" + Math.floor(Math.random() * 10000);

            return new Promise(function (resolve, reject) {
                var createPrintRecord = that.getModel("Print").bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTemplateID || "YY1_BOMPRINT");
                createPrintRecord.setParameter("IsExternalProvidedData", true);
                var oXMLData = json2xml(pdfContent, {
                    compact: true,
                    ignoreComment: true,
                    spaces: 4
                });
                var pdfData = btoa(unescape(encodeURIComponent("<?xml version=\"1.0\" encoding=\"UTF-8\"?><form>" + oXMLData + "</form>")));
                createPrintRecord.setParameter("ExternalProvidedData", pdfData);
                createPrintRecord.setParameter("ProvidedKeys", "");
                createPrintRecord.setParameter("ResultIsActiveEntity", true);
                createPrintRecord.setParameter("FileName", sFileName);
                createPrintRecord.execute("$auto", false, null, false).then(function () {
                    var oObject = createPrintRecord.getBoundContext().getObject();
                    resolve(oObject.RecordUUID);
                }).catch(function (oError) {
                    reject(oError);
                });
            });
        },

        _mergeCNAndOpenPdf: function (aRecordUUIDs) {
            var that = this;
            var aValidUUIDs = (aRecordUUIDs || []).filter(function (sUUID) {
                return !!sUUID;
            });

            if (aValidUUIDs.length === 0) {
                return Promise.reject(new Error("No print records created for CN print."));
            }

            return this._ensurePdfLibLoaded().then(function () {
                var aFetchPromises = aValidUUIDs.map(function (sUUID) {
                    return that._fetchPdfAsArrayBuffer(sUUID);
                });
                return Promise.all(aFetchPromises);
            }).then(function (aPdfBuffers) {
                return that._openMergedPdfFromBuffers(aPdfBuffers);
            });
        },

        processPrintContentCNStep1: function (oSelected, aAllData, HeaderValidityStartDate, sCNValidPeriod) {
            var oHeadSource = (aAllData && aAllData.length > 0) ? aAllData[0] : (oSelected || {});
            
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };
            
            var RetPrint = {
                FileNo: oHeadSource.FILENO,
                CreateDate: oHeadSource.CREATEDATE,
                ValidPeriod: sCNValidPeriod || oHeadSource.VALIDPERIOD || "长期有效",
                BarCode: oHeadSource.BARCODE,
                Customer: oHeadSource.CUSTOMER,
                EndUser: oHeadSource.ENDUSER,
                ProjectName: oHeadSource.PROJECTNAME,
                ProjectCode: oHeadSource.PROJECTCODE,
                CreateBy: oHeadSource.CREATEBY,
                Special: oHeadSource.SPECIAL,
                Version: oHeadSource.VERSION,
                ROHS: oHeadSource.ROHS,
                NoROHS: oHeadSource.NOROHS,
                Car: oHeadSource.CAR,
                NoCar: oHeadSource.NOCAR,
                RHF: oHeadSource.RHF,
                GP: oHeadSource.GP,
            };

            pdfContent = {
                PrintData: RetPrint
            };

            return pdfContent;
        },

        processPrintContentCNStep2: function (oSelected, aAllData) {
            var oHeadSource = (aAllData && aAllData.length > 0) ? aAllData[0] : (oSelected || {});
            
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };  

            var oStep2PrintData = {
                // Step2: 头表 + 明细
                ProjectName: oHeadSource.PROJECTNAME,
                ProjectCode: oHeadSource.PROJECTCODE,
                FileNo: oHeadSource.FILENO,
                to_Item: {
                    results: (aAllData || []).map(function (item) {
                        return {
                            Number: item.NUMBER,
                            Date: item.DATE,
                            BomVer: item.BOMVER,
                            EcoNo: item.ECONO,
                            RevisionDetails: item.REVISIONDETAILS,
                            DocumentNo: item.DOCUMENTNO,
                            MioLotNo: item.MIOLOTNO,
                        };
                    })
                }
            };

            pdfContent = {
                PrintData: oStep2PrintData
            };

            return pdfContent;  
        },

        processPrintContentCNStep3: function (oSelected, aAllData) {
            var oHeadSource = (aAllData && aAllData.length > 0) ? aAllData[0] : (oSelected || {});
            
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };

            var oStep3PrintData = {
                // Step3: 与原有 CN 明细结构一致
                Document: oHeadSource.DOCUMENT,
                ValidfromDate: oHeadSource.VALIDFROMDATE,
                History: oHeadSource.HISTORY,
                Revision: oHeadSource.REVISION,
                Model: oHeadSource.MODEL,
                Formula: oHeadSource.FORMULA,
                Description: oHeadSource.DESCRIPTION,
                Customer: oHeadSource.CUSTOMER,
                EndUser: oHeadSource.ENDUSER,
                CreateBy: oHeadSource.CREATEBY,
                PrintUser: oHeadSource.PRINTUSER,
                RohsTag: oHeadSource.ROHSTAG,
                to_Item: {
                    results: (aAllData || []).map(function (item) {
                        return {
                            Material: item.MATERIAL,
                            BOMlevel: item.BOMLEVEL,
                            AltGrp: item.ALTGRP,
                            FolGrp: item.FOLGRP,
                            PartNo: item.PARTNO,
                            PartName: item.PARTNAME,
                            Specification: item.SPECIFICATION,
                            MakerPartNo: item.MAKERPARTNO,
                            Boi: item.BOI,
                            RefNo: item.REFNO,
                            Qty: item.QTY,
                            Unit: item.UNIT,
                            Loc: item.LOC,
                            SaftyCERT: item.SAFTYCERT,
                            ValidPeriod: item.VALIDPERIOD,
                            Sup: item.SUP,
                            Remark: item.REMARK,
                            CustomerPartNo: item.CUSTOMERPARTNO,
                            RoHS: item.ROHS
                        };
                    })
                }
            };

            pdfContent = {
                PrintData: oStep3PrintData
            };

            return pdfContent; 
        },

        processPrintContent2400: function (oSelected, aAllData) {
            var oPayload = Array.isArray(aAllData) ? ((aAllData[0]) || {}) : (aAllData || {});
            var aItem1 = Array.isArray(oPayload.ITEM1) ? oPayload.ITEM1 : [];
            var aItem2 = Array.isArray(oPayload.ITEM2) ? oPayload.ITEM2 : [];

            function getField(oItem, sKey) {
                if (!oItem) {
                    return "";
                }
                return oItem[sKey] !== undefined ? oItem[sKey] : "";
            }

            function mapItem1(oItem) {
                return {
                    NUMBER: getField(oItem, "NUMBER"),
                    ALTGRP: getField(oItem, "ALTGRP"),
                    FOLGRP: getField(oItem, "FOLGRP"),
                    PARTNAME: getField(oItem, "PARTNAME"),
                    SPECIFICATION: getField(oItem, "SPECIFICATION"),
                    MAKERPARTNO: getField(oItem, "MAKERPARTNO"),
                    VIRGINMATERIALRATIO: getField(oItem, "VIRGINMATERIALRATIO"),
                    RECYCLEDMATERIALRATIO: getField(oItem, "RECYCLEDMATERIALRATIO"),
                    NETWEIGHTOFCOMPONENT: getField(oItem, "NETWEIGHTOFCOMPONENT"),
                    RUNNERWEIGHTPERSHOT: getField(oItem, "RUNNERWEIGHTPERSHOT"),
                    SINGLERUNNERWEIGHT: getField(oItem, "SINGLERUNNERWEIGHT"),
                    UNITCONSUMPTIONWEIGHT: getField(oItem, "UNITCONSUMPTIONWEIGHT"),
                    UNIT: getField(oItem, "UNIT"),
                    LOC: getField(oItem, "LOC"),
                    STATUS: getField(oItem, "STATUS"),
                    VALIDITYPERIOD: getField(oItem, "VALIDITYPERIOD"),
                    PROCUREMENTMETHOD: getField(oItem, "PROCUREMENTMETHOD"),
                    REMARKS: getField(oItem, "REMARKS"),
                    CUSTOMERPARTNO: getField(oItem, "CUSTOMERPARTNO"),
                    ROHS: getField(oItem, "ROHS")
                };
            }

            function mapItem2(oItem) {
                return {
                    NUMBER: getField(oItem, "NUMBER"),
                    ALTGRP: getField(oItem, "ALTGRP"),
                    FOLGRP: getField(oItem, "FOLGRP"),
                    PARTNAME: getField(oItem, "PARTNAME"),
                    SPECIFICATION: getField(oItem, "SPECIFICATION"),
                    SUPPLIERMATERIAL: getField(oItem, "SUPPLIERMATERIAL"),
                    PACKQUANTITY: getField(oItem, "PACKQUANTITY"),
                    UNITPACKAGINGWEIGHT: getField(oItem, "UNITPACKAGINGWEIGHT"),
                    PACKAGINGCONSUMPTIONQUANTITY: getField(oItem, "PACKAGINGCONSUMPTIONQUANTITY"),
                    UNIT: getField(oItem, "UNIT"),
                    TOTALWEIGHT: getField(oItem, "TOTALWEIGHT"),
                    LOC: getField(oItem, "LOC"),
                    STATUS: getField(oItem, "STATUS"),
                    VALIDITYPERIOD: getField(oItem, "VALIDITYPERIOD"),
                    PROCUREMENTMETHOD: getField(oItem, "PROCUREMENTMETHOD"),
                    REMARKS: getField(oItem, "REMARKS"),
                    CUSTOMERPARTNUMBER: getField(oItem, "CUSTOMERPARTNUMBER"),
                    ROHS: getField(oItem, "ROHS")
                };
            }

            return {
                PrintData: {
                    FILENAME: oPayload.FILENAME,
                    CREATEBY: oPayload.CREATEBY,
                    SPECIAL: oPayload.SPECIAL,
                    VERSION: oPayload.VERSION,
                    CREATEDATE: oPayload.CREATEDATE,
                    PROJECTNO: oPayload.PROJECTNO,
                    MATERIAL: oPayload.MATERIAL,
                    CUSTOMER: oPayload.CUSTOMER,
                    ENDUSER: oPayload.ENDUSER,
                    STANDARDDATAEXT: oPayload.STANDARDDATAEXT,
                    MACHINE: oPayload.MACHINE,
                    MODELNO: oPayload.MODELNO,
                    MOLDINGCYCLETIME: oPayload.MOLDINGCYCLETIME,
                    OPERATORS: oPayload.OPERATORS,
                    MOLDNO: oPayload.MOLDNO,
                    ROHSTAG: oPayload.ROHSTAG,
                    ITEM1: aItem1.map(mapItem1),
                    ITEM2: aItem2.map(mapItem2)
                }
            };
        },

        _ensurePdfLibLoaded: function () {
            if (window.PDFLib && window.PDFLib.PDFDocument) {
                return Promise.resolve();
            }

            if (this._pdfLibLoadPromise) {
                return this._pdfLibLoadPromise;
            }

            this._pdfLibLoadPromise = new Promise(function (resolve, reject) {
                var oScript = document.createElement("script");
                oScript.src = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
                oScript.async = true;
                oScript.onload = function () {
                    if (window.PDFLib && window.PDFLib.PDFDocument) {
                        resolve();
                    } else {
                        reject(new Error("PDF merge library loaded but unavailable."));
                    }
                };
                oScript.onerror = function () {
                    reject(new Error("Failed to load PDF merge library from CDN."));
                };
                document.head.appendChild(oScript);
            });

            return this._pdfLibLoadPromise;
        },

        _fetchPdfAsArrayBuffer: function (sRecordUUID) {
            var iMaxRetries = 120;
            var iRetryIntervalMs = 3000;

            var sKeyPredicate = this.getModel("Print").getKeyPredicate("/PrintRecord", {
                RecordUUID: sRecordUUID,
                IsActiveEntity: true
            });
            var sURL = this.getModel("Print").getServiceUrl() + "PrintRecord" + sKeyPredicate + "/PDFContent";

            function doFetch(iAttempt) {
                return fetch(sURL, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/pdf,application/json,text/plain,*/*"
                    }
                }).then(function (oResponse) {
                    // Some backends return 400/404 until async render finishes.
                    if (!oResponse.ok && oResponse.status !== 400 && oResponse.status !== 404) {
                        throw new Error("Failed to load PDF content for record " + sRecordUUID + " (HTTP " + oResponse.status + ").");
                    }

                    if (!oResponse.ok) {
                        if (iAttempt < iMaxRetries) {
                            return new Promise(function (resolve) {
                                setTimeout(function () { resolve(doFetch(iAttempt + 1)); }, iRetryIntervalMs);
                            });
                        }
                        throw new Error("PDF not ready after " + iMaxRetries + " retries for record " + sRecordUUID + ".");
                    }

                    var sContentType = (oResponse.headers.get("content-type") || "").toLowerCase();

                    // Binary PDF directly returned
                    if (sContentType.indexOf("application/pdf") > -1) {
                        return oResponse.arrayBuffer().then(function (oBuffer) {
                            if (oBuffer && oBuffer.byteLength > 0) {
                                return oBuffer;
                            }
                            if (iAttempt < iMaxRetries) {
                                return new Promise(function (resolve) {
                                    setTimeout(function () { resolve(doFetch(iAttempt + 1)); }, iRetryIntervalMs);
                                });
                            }
                            throw new Error("Empty PDF content after " + iMaxRetries + " retries for record " + sRecordUUID + ".");
                        });
                    }

                    return oResponse.text().then(function (sText) {
                        var sTrimmed = (sText || "").trim();
                        var sBase64 = "";

                        if (sContentType.indexOf("application/json") > -1 || sTrimmed.indexOf("{") === 0) {
                            try {
                                var oJson = JSON.parse(sTrimmed || "{}");
                                sBase64 = oJson.PDFContent || oJson.value || "";
                            } catch (e) {
                                // not parseable, fall through to retry
                            }
                        } else {
                            sBase64 = sTrimmed;
                        }

                        // Content is empty — backend hasn't rendered yet, retry
                        if (!sBase64) {
                            if (iAttempt < iMaxRetries) {
                                return new Promise(function (resolve) {
                                    setTimeout(function () { resolve(doFetch(iAttempt + 1)); }, iRetryIntervalMs);
                                });
                            }
                            throw new Error("PDF not ready after " + iMaxRetries + " retries for record " + sRecordUUID + ".");
                        }

                        var sNormalized = sBase64.replace(/^data:application\/pdf;base64,/, "").replace(/\s+/g, "");

                        // Plain-text PDF bytes (rare)
                        if (sTrimmed.indexOf("%PDF-") === 0) {
                            return new TextEncoder().encode(sTrimmed).buffer;
                        }

                        // Validate it looks like base64-encoded PDF
                        if (sNormalized.indexOf("JVBERi0") !== 0) {
                            if (iAttempt < iMaxRetries) {
                                return new Promise(function (resolve) {
                                    setTimeout(function () { resolve(doFetch(iAttempt + 1)); }, iRetryIntervalMs);
                                });
                            }
                            throw new Error("Record " + sRecordUUID + " still returns non-PDF content after " + iMaxRetries + " retries.");
                        }

                        var sBinary = atob(sNormalized);
                        var aBytes = new Uint8Array(sBinary.length);
                        for (var i = 0; i < sBinary.length; i++) {
                            aBytes[i] = sBinary.charCodeAt(i);
                        }
                        return aBytes.buffer;
                    });
                });
            }

            return doFetch(1);
        },

        _openPdfFromBuffer: function (oPdfBuffer) {
            return new Promise(function (resolve, reject) {
                try {
                    var oBlob = new Blob([oPdfBuffer], {
                        type: "application/pdf"
                    });
                    var sBlobUrl = URL.createObjectURL(oBlob);

                    var oOpenedWindow = window.open(sBlobUrl, "_blank");
                    if (!oOpenedWindow) {
                        var oLink = document.createElement("a");
                        oLink.href = sBlobUrl;
                        oLink.target = "_blank";
                        oLink.rel = "noopener noreferrer";
                        document.body.appendChild(oLink);
                        oLink.click();
                        document.body.removeChild(oLink);
                    }

                    setTimeout(function () {
                        URL.revokeObjectURL(sBlobUrl);
                    }, 10000);

                    sap.m.MessageToast.show("Print Success");
                    resolve();
                } catch (oError) {
                    reject(oError);
                }
            });
        },

        _openMergedPdfFromBuffers: function (aPdfBuffers) {
            return new Promise(function (resolve, reject) {
                try {
                    (async function () {
                        var PDFDocument = window.PDFLib.PDFDocument;
                        var oMergedPdf = await PDFDocument.create();

                        for (var i = 0; i < aPdfBuffers.length; i++) {
                            var oSourcePdf = await PDFDocument.load(aPdfBuffers[i]);
                            var aPageIndices = oSourcePdf.getPageIndices();
                            var aCopiedPages = await oMergedPdf.copyPages(oSourcePdf, aPageIndices);
                            aCopiedPages.forEach(function (oPage) {
                                oMergedPdf.addPage(oPage);
                            });
                        }

                        var aMergedBytes = await oMergedPdf.save();
                        var oBlob = new Blob([aMergedBytes], {
                            type: "application/pdf"
                        });
                        var sBlobUrl = URL.createObjectURL(oBlob);

                        var oOpenedWindow = window.open(sBlobUrl, "_blank");
                        if (!oOpenedWindow) {
                            var oLink = document.createElement("a");
                            oLink.href = sBlobUrl;
                            oLink.target = "_blank";
                            oLink.rel = "noopener noreferrer";
                            document.body.appendChild(oLink);
                            oLink.click();
                            document.body.removeChild(oLink);
                        }

                        setTimeout(function () {
                            URL.revokeObjectURL(sBlobUrl);
                        }, 10000);

                        sap.m.MessageToast.show("Print Success");
                        resolve();
                    })().catch(function (oError) {
                        reject(oError);
                    });
                } catch (oError) {
                    reject(oError);
                }
            });
        },

        getPDF: function (pdfContent, sTemplateID) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = this.getView().getModel("i18n").getResourceBundle().getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = this.getModel("Print").bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTemplateID || "YY1_BOMPRINT");
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
                        var sPath = this.getModel("Print").getKeyPredicate("/PrintRecord", object);
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
            };
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        onBeforeRebindTable: function (oEvent) {
            let aFilters = oEvent.getParameters().bindingParams.filters;
            var oValDate = this.getOwnerComponent().getModel("local").getProperty("/ValDate");
            if (oValDate) {
                var aDates = DynamicDateUtil.toDates(oValDate);
                var oFmt = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyyMMdd",
                });
                var sDates = oFmt.format(aDates[0]);
                var oHeaderValidityStartDate = new sap.ui.model.Filter({
                    path: "HeaderValidityStartDate",
                    operator: "EQ",
                    value1: aDates[1] //sDates
                });

               aFilters.push(oHeaderValidityStartDate);
            };
        },

        onSearch: function (oEvent) {
            var aFilters, sPath;
                sPath = "/BOM";
                aFilters = this.byId("idSmartFilterBar").getFilters()[0].aFilters;
                var oValDate = this.getOwnerComponent().getModel("local").getProperty("/ValDate");
                if (oValDate) {
                    var aDates = DynamicDateUtil.toDates(oValDate);
                    var oHeaderValidityStartDate = new sap.ui.model.Filter({
                        path: "HeaderValidityStartDate",
                        operator: "EQ",
                        value1: aDates[1]
                    });

                aFilters.push(oHeaderValidityStartDate);
                };
            // }
            // 并行处理 优化速度
            this.getModel().setUseBatch(false);
            // this._CallODataV2("READ", sPath, aFilters, { "$top": 999999999 }, {}).then(function (oResponse) {
            //     if (oResponse) {
            //         this.getModel("local").setProperty("/Bom", oResponse.results);
            //     }
            this._loadAllData(sPath, aFilters).then(function (aAllData) {
                if (aAllData.length > 0) {
                    this.getModel("local").setProperty("/Bom", aAllData);
                }
                this.getModel().setUseBatch(true);
            }.bind(this)), function (oError) {
                this.getModel().setUseBatch(true);
            }.bind(this);
        },

        onExport: function () {
            var oTable = this.byId("idTable");
            var aExcelSet = this.getModel("local").getProperty("/Bom");
            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, sUnitProperty, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").getBindingPath("text");
                    if (!sFieldName) {
                        sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.value.parts[0].path;
                    }
                    switch (sFieldName) {
                        //  Date
                        case "HeaderValidityStartDate":
                            sType = sap.ui.export.EdmType.Date;
                            break;
                        //  Number
                        case "BillOfMaterialSubItemQuantity":
                        case "NetWeight":
                        case "BomHeaderQuantityInBaseUnit":
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            iScale = 3;
                            sTextAlign = "End";
                            break;
                        //  Number 6Scale
                        case "ComponentQuantityInCompUoM":
                        case "ComponentQuantityInBaseUoM":
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            iScale = 6;
                            sTextAlign = "End";
                            // sUnitProperty = "";
                            break;
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            sUnitProperty = "";
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
                fileName: this.getModel("i18n").getResourceBundle().getText("BomFileName") + "_" + this.getCurrentDateTime() + ".xlsx"
            };
            // export excel file
            new Spreadsheet(oSettings).build();
        },

        onBeforeExport: function (oEvent) {
            var oSettings = oEvent.getParameter("exportSettings");
            var columns = oSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "ComponentQuantityInCompUoM":
                    case "BillOfMaterialSubItemQuantity":
                    case "NetWeight":
                    case "ComponentQuantityInBaseUoM":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        // oColumn.delimiter = true;
                        // oColumn.scale = 2;
                        break;
                    case "HeaderValidityStartDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                }
            });
        },
    });
});
