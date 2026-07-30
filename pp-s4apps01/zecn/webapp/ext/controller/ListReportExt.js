sap.ui.define([
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../../lib/xml-js",
    "sap/m/MessageToast"
], function (BusyDialog, MessageBox, Fragment, Filter, FilterOperator,xml,MessageToast) {
    'use strict';

    var _oFunctions, _ResourceBundle, _oDataModel, _oPrintModel, _UserInfo;
    return {

        init: function (oModels, oViews) {
            _oFunctions = this;
            _UserInfo = sap.ushell.Container.getService("UserInfo");

            // Authority Check
            var oAuthorityModel = oModels.Authority;
            var oLocalModel = oModels.local;
            var oI18nModel = oModels.i18n;
            this._getAuthorityData(oAuthorityModel, oLocalModel, oI18nModel, oViews);
        },

        _getAuthorityData: function (oAuthorityModel, oLocalModel, oI18nModel, oViews) {
            var sUser = _UserInfo.getFullName() === undefined ? "" : _UserInfo.getFullName();
            var sEmail = _UserInfo.getEmail() === undefined ? "" : _UserInfo.getEmail();
            var oContextBinding = oAuthorityModel.bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zecn-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: oI18nModel.getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    oViews.destroy();
                    this.oErrorMessageDialog.open();
                }
                oLocalModel.setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zecn-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "zecn-Print"),
                        PrintCN: aAllAccessBtns.some(btn => btn.AccessId === "zecn-PrintCN")
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
                            text: oI18nModel.getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                oViews.destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        printAction: function (oEvent) {
            _oFunctions.getPrintData(oEvent,this);
        },

        printcnAction: function (oEvent){
            _oFunctions.getPrintData(oEvent,this,"CN");
        },

        getPrintData: function (oEvent,that,sType){
            var oBusyDialog = new BusyDialog();
            _oDataModel = that.getModel();
            _oPrintModel = that.getModel("Print");
            _ResourceBundle = that.getModel("i18n").getResourceBundle();

            oBusyDialog.open();
            var aSelectedContexts = that.getSelectedContexts();

            // 按 ECNNo 去重，保留每个 ECNNo 的第一条
            var aUniqueLines = [];
            var oSeenECN = {};
            if (aSelectedContexts.length > 0) {
                aSelectedContexts.forEach(function (oContext) {
                    var oLine = oContext.getObject();
                    if (oLine.ECNNo && !oSeenECN[oLine.ECNNo]) {
                        oSeenECN[oLine.ECNNo] = true;
                        aUniqueLines.push(oLine);
                    }
                });
            }

            // 为每个唯一 ECN 并行生成 PDF
            var aPromises = aUniqueLines.map(function (oLine) {
                return _oFunctions._processSinglePrint(oLine, sType);
            });

            Promise.all(aPromises).finally(function () {
                oBusyDialog.close();
            });
        },
        _processSinglePrint: function (oSelectedLine, sType) {
            return new Promise(function (resolve) {

                //获取行项目数据
                var aFilters = [];
                aFilters.push(new Filter({
                    path: "ECNNo",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.ECNNo
                }));
                aFilters.push(new Filter({
                    path: "Plant",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.Plant
                }));
                //Material 和 TopLayerMaterial 相同
                aFilters.push(new Filter({
                    path: "Material",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.Material
                }));
                aFilters.push(new Filter({
                    path: "subitem",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.subitem
                }));
                var oContextBinding = _oDataModel.bindList("/ECN", undefined, undefined, aFilters, {});
                //add by zhao.w 20260609 for longtext printing CM#6159 TH-P-039
                var sLongText = "";
                var sECNCreateAt = "";
                var sECNValidFrom = "";
                //从 i18n获取 After 的翻译
                var sAfter = _ResourceBundle.getText("After");
                //add by zhao.w 20260609 for longtext printing CM#6159 TH-P-039

                var aPrintItem = [];
                var oItemPromise =  oContextBinding.requestContexts();
                oItemPromise.then(function(aContext){
                    for (const boundContext of aContext) {
                        var object = boundContext.getObject();

                        //add by zhao.w 20260609 for longtext printing CM#6159 TH-P-039
                        // 特殊打印项目
                        if (object.isspecialprintitem === 'X') {
                            // 只记录一次 longtext
                            if (!sLongText && object.long_text) {
                                sLongText = object.long_text;
                            };

                            if (!sECNCreateAt && object.ECNCreateAt) {
                                sECNCreateAt = object.ECNCreateAt;
                            };

                            if (!sECNValidFrom && object.ECNValidFrom) {
                                sECNValidFrom = object.ECNValidFrom;
                            };

                            // 不进入正常明细
                            continue;
                        };
                        //add by zhao.w 20260609 for longtext printing CM#6159 TH-P-039

                        //TH 打印before行 这几个字段不需要值
                        if (object.ChangeDiffCode === '01' && object.Plant === "4000" ) {
                            object.ChangeContent = "";
                            object.Stock = "";
                            object.Manage = "";
                        }

                        aPrintItem.push({
                            Seq: object.serialnumber,
                            SerialNumber: object.serialnumber,
                            BeforAfter: object.changediff,
                            PartNo: object.Component,
                            Specification: object.DetSpecification,
                            ChangeContent: object.ChangeContent,
                            RefNo: object.BOMSubItemInstallationPoint,
                            Quantity: object.Quantity,
                            Unit: object.Unit,
                            Loc: object.BomItemSorter,
                            Stock: object.Stock,
                            Manage: object.Manage,
                            ECNCreateAt: object.ECNCreateAt,
                            ECNValidFrom: object.ECNValidFrom,
                            AltGroup : object.AltGroup
                        });
                        //add by zhao.w 20260609 for longtext printing CM#6159 TH-P-039
                        // 只记录一次 longtext
                        if (!sLongText && object.long_text) {
                            sLongText = object.long_text;
                        };
                    }
                    // 循环结束后统一追加一行
                    if (sLongText) {
                        aPrintItem.push({
                            Seq: "999999",
                            SerialNumber: "",
                            BeforAfter: sAfter,
                            PartNo: "",
                            Specification: "",
                            ChangeContent: sLongText,
                            RefNo: "",
                            Quantity: "",
                            Unit: "",
                            Loc: "",
                            Stock: "",
                            Manage: "",
                            ECNCreateAt: sECNCreateAt,
                            ECNValidFrom: sECNValidFrom,
                            AltGroup: ""
                        });
                    }
                    //add by zhao.w 20260609 for longtext printing CM#6159 TH-P-039
                    // ====== 修正：基于整个 Seq 判断是否有 AltGroup ======
                    var norm = aPrintItem.filter(e => e.Seq !== "999999");
                    var long = aPrintItem.find(e => e.Seq === "999999");

                    // 1. 先扫描所有行，标记哪些 Seq 有 AltGroup
                    var hasGrp = {};
                    norm.forEach(e => { if (e.AltGroup) hasGrp[e.Seq] = true; });

                    // 2. 按原始出现顺序收集 Seq，区分有无组
                    var noGrp = [], grpSeqs = [], seen = {};
                    norm.forEach(e => {
                        if (!seen[e.Seq]) {
                            seen[e.Seq] = true;
                            hasGrp[e.Seq] ? grpSeqs.push(e.Seq) : noGrp.push(e.Seq);
                        }
                    });

                    // 3. 构建 Seq → SerialNumber 映射
                    var map = {}, num = 0;
                    noGrp.forEach(s => map[s] = ++num);
                    if (grpSeqs.length) { ++num; grpSeqs.forEach(s => map[s] = num); }

                    // 4. 排序：无组内 Before→After；有组先全部 Before 再全部 After
                    var result = [];
                    noGrp.forEach(s => {
                        result.push(...norm.filter(e => e.Seq === s && e.BeforAfter === 'Before'));
                        result.push(...norm.filter(e => e.Seq === s && e.BeforAfter !== 'Before'));
                    });
                    var before = grpSeqs.flatMap(s => norm.filter(e => e.Seq === s && e.BeforAfter === 'Before'));
                    var after  = grpSeqs.flatMap(s => norm.filter(e => e.Seq === s && e.BeforAfter !== 'Before'));
                    result.push(...before, ...after);

                    // 5. 统一写入编号，追加特殊行
                    result.forEach(e => e.SerialNumber = map[e.Seq]);
                    if (long) { long.SerialNumber = ++num; result.push(long); }
                    aPrintItem = result;

                });

                var aHeadFilters = [];
                aHeadFilters.push(new Filter({
                    path: "ChangeNumber",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.ECNNo
                }));
                aHeadFilters.push(new Filter({
                    path: "Plant",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.Plant
                }));
                //Material 和 TopLayerMaterial 相同
                aHeadFilters.push(new Filter({
                    path: "Material",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.Material
                }));
                aHeadFilters.push(new Filter({
                    path: "BillOfMaterialVariant",
                    operator: FilterOperator.EQ,
                    value1: oSelectedLine.BillOfMaterialVariant
                }));
                //获取抬头数据
                var pdfContent;
                var oHeadContextBinding = _oDataModel.bindList("/EcnPrint", undefined, undefined, aHeadFilters, {});
                var oHeadPromise = oHeadContextBinding.requestContexts(0,1);
                oHeadPromise.then(function(aContext){
                    if (aContext.length > 0) {
                        var object = aContext[0].getObject();
                        pdfContent = {PrintData:{
                            ChangeNumber: object.ChangeNumber,
                            Material: object.Material,
                            Plant: object.Plant,
                            // CreatedDate: object.CreatedDate,
                            BomHistory: object.BomHistory,
                            Project: object.Project,
                            ProjectName: object.ProjectName,
                            EndUser: object.EndUser,
                            FreeDefinedAttribute02: object.FreeDefinedAttribute02,
                            Customer: object.Customer,
                            CustomerName: object.CustomerName,
                            ReqByCustomer: object.ReqByCustomer,
                            ReqByJp: object.ReqByJp,
                            ReqByHk: object.ReqByHk,
                            ReqByCn: object.ReqByCn,
                            ReqByVn: object.ReqByVn,
                            ReqByOther: object.ReqByOther,
                            ReqByOtherText: object.ReqByOtherText,
                            BomRev: object.BomRev,
                            EcoTypeDesc: object.EcoTypeDesc,
                            StockOfSfgSmt: object.StockOfSfgSmt,
                            UnitSfgSmt: object.UnitSfgSmt,
                            StockOfSfgFat: object.StockOfSfgFat,
                            UnitSfgFat: object.UnitSfgFat,
                            StockOfNcgSmt: object.StockOfNcgSmt,
                            UnitNcgSmt: object.UnitNcgSmt,
                            StockOfNcgFat: object.StockOfNcgFat,
                            UnitNcgFat: object.UnitNcgFat,
                            StockOfFg: object.StockOfFg,
                            UnitFg: object.UnitFg,
                            OldNewNotTogether: object.OldNewNotTogether,
                            OldStockDelivery: object.OldStockDelivery,
                            ReworkSfg: object.ReworkSfg,
                            ReworkFg: object.ReworkFg,
                            Other: object.Other,
                            ReasonForChange: object.ReasonForChange,
                            AttachedDocuments: object.AttachedDocuments,
                            CreatedByUser: object.CreatedByUser,
                            ChangeBasis: object.ChangeBasis,
                            ChangeNode: object.ChangeNode,
                            to_Items:{
                                results: aPrintItem
                            }
                        }};
                        if ( pdfContent.PrintData.UnitSfgSmt ) {
                            pdfContent.PrintData.StockOfSfgSmt = pdfContent.PrintData.StockOfSfgSmt + " " + pdfContent.PrintData.UnitSfgSmt;
                        }
                        if ( pdfContent.PrintData.UnitSfgFat ) {
                            pdfContent.PrintData.StockOfSfgFat = pdfContent.PrintData.StockOfSfgFat + " " + pdfContent.PrintData.UnitSfgFat;
                        }
                        if ( pdfContent.PrintData.UnitNcgSmt ) {
                            pdfContent.PrintData.StockOfNcgSmt = pdfContent.PrintData.StockOfNcgSmt + " " + pdfContent.PrintData.UnitNcgSmt;
                        }
                        if ( pdfContent.PrintData.UnitNcgFat ) {
                            pdfContent.PrintData.StockOfNcgFat = pdfContent.PrintData.StockOfNcgFat + " " + pdfContent.PrintData.UnitNcgFat;
                        }
                        if ( pdfContent.PrintData.UnitFg ) {
                            pdfContent.PrintData.StockOfFg = pdfContent.PrintData.StockOfFg + " " + pdfContent.PrintData.UnitFg;
                        }
                    }

                });

                Promise.all([oItemPromise,oHeadPromise]).then(async function(){
                    await _oFunctions.wait(1000);
                    if (pdfContent) {
                        pdfContent.PrintData.to_Items = { results: aPrintItem };
                        pdfContent.PrintData.CreatedDate = aPrintItem[0]?.ECNCreateAt;
                        pdfContent.PrintData.CreatedDateFooter = aPrintItem[0]?.ECNValidFrom;
                        if (sType === "CN") {
                            _oFunctions.getPDF(pdfContent,"YY1_PP008_CN");
                        } else {
                            switch (pdfContent.PrintData.Plant) {
                                case "3000":
                                    _oFunctions.getPDF(pdfContent,"YY1_PP008_VN");break;
                                case "4000":
                                    _oFunctions.getPDF(pdfContent,"YY1_PP008_TH");break;
                            }
                        }
                    }
                    resolve();
                }).catch(function () {
                    resolve(); // 单个 ECN 失败不阻塞其他
                });
            });
        },

        getPDF: function (pdfContent,template) {
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = _ResourceBundle.getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = _oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", template);
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
                        var sPath = _oPrintModel.getKeyPredicate("/PrintRecord", object);
                        sURL = activeContext.getModel("Print").getServiceUrl() + "PrintRecord" + sPath + '/PDFContent';
                        sap.m.URLHelper.redirect(sURL, true);
                    }
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });;
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            }
        },
        // 定义等待函数
		wait: function(ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		},

    };
});
