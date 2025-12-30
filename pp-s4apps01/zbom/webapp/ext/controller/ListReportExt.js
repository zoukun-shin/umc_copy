sap.ui.define([
    "sap/m/BusyDialog",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/mdc/Table",
    "sap/ui/table/Table",
    "../../lib/xml-js",
    "sap/ui/core/date/UI5Date",
    "../../lib/decimal",
    "./messages"
], function (BusyDialog, MessageToast, MessageBox, Fragment, Filter, FilterOperator, Table, xml, UI5Date, decimal, messages) {
    'use strict';

    var _UserInfo, _oFunctions, _ResourceBundle, _oPrintModel, _oDataModel;
    return {

        init: function (oModels, oViews) {
            _oFunctions = this;

            _UserInfo = sap.ushell.Container.getService("UserInfo");

            // Authority Check
            var oAuthorityModel = oModels.Authority;
            var oLocalModel = oModels.local;
            var oI18nModel = oModels.i18n;
            //this._getAuthorityData(oAuthorityModel, oLocalModel, oI18nModel, oViews);
        },

        _getAuthorityData: function (oAuthorityModel, oLocalModel, oI18nModel, oViews) {
            var sUser = _UserInfo.getFullName() === undefined ? "" : _UserInfo.getFullName();
            var sEmail = _UserInfo.getEmail() === undefined ? "" : _UserInfo.getEmail();
            sEmail = "xinlei.xu@sh.shin-china.com";
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zbom-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zbom-View")
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
        onPrint: function (aSelectedContexts) {

            _oPrintModel = this.getModel("Print");
            var sActionName = "PrintBom";
            _oDataModel = this.getModel();
            _ResourceBundle = this.getModel("i18n").getResourceBundle();

            var oTable = sap.ui.getCore().byId("pp.zbom::BOMList--fe::table::BOM::LineItem");
            var oBinding = oTable.getRowBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());

            var aSelectedContexts = [];

            if (this.getSelectedContexts) {
                aSelectedContexts = this.getSelectedContexts();
            }

            var HeaderValidityStartDate = aSelectedContexts[0].getObject().HeaderValidityStartDate; // 选中的实体对象
            var oSelected = aSelectedContexts[0].getObject();
            var oModel = this._view.getModel();
            var aFilters = _oFunctions.getFilter(HeaderValidityStartDate);

            if (aSelectedContexts.length > 1) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            }

            var aItems = _oFunctions.getItems(oSelected, aAllData);
            var aItems2 = _oFunctions.getItems2(aFilters);
            var aPromise = [];
            aPromise.push(_oFunctions.printAction(aItems, sActionName));
            Promise.all(aPromise).then(function (records) {
                records.forEach(record => {
                    var pdfContent = _oFunctions.processPrintContent(oSelected, record, HeaderValidityStartDate);
                    _oFunctions.getPDF(pdfContent);

                });
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
                ValidfromDate: HeaderValidityStartDate,
                History: aAllData[0].History,
                Revision: aAllData[0].Revision,
                Model: aAllData[0].Model,
                Formula: aAllData[0].Formula,
                Description: aAllData[0].Description,
                Costomer: aAllData[0].Costomer,
                //Date: 
                to_Item: {
                    results: []
                }
            };

            var iIndex = 0;
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

        getPDF: function (pdfContent) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = _ResourceBundle.getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = _oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", "YY1_BOMPRINT");
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
                });
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            };
        },

        getFilter: function (HeaderValidityStartDate) {
            // 获取 FilterBar
            var oFilterBar = sap.ui.getCore().byId("pp.zbom::BOMList--fe::FilterBar::BOM");
            if (!oFilterBar) {
                return [];
            }

            // 触发 FilterBar 校验，让 SmartField 自动解析其他动态日期（除了HeaderValidityStartDate）
            oFilterBar.validate();

            // 获取所有 FilterItems
            var aFilterItems = oFilterBar.getFilterItems();
            var aFilters = [];

            aFilterItems.forEach(function (oItem) {
                var sField = oItem.getName ? oItem.getName() : (oItem.getId() ? oItem.getId().split("::").pop() : "");

                // 获取条件
                var aConditions = [];
                if (oItem.getConditions) {
                    aConditions = oItem.getConditions();
                } else if (oItem.mBindingInfos && oItem.mBindingInfos.conditions) {
                    aConditions = oItem.mBindingInfos.conditions.parts || [];
                }

                if (aConditions && aConditions.length > 0) {
                    aConditions.forEach(function (cond) {
                        var vValue1 = null;
                        var vValue2 = null;

                        // 针对 HeaderValidityStartDate 字段，使用选中行的值
                        if (sField === "HeaderValidityStartDate") {
                            vValue1 = HeaderValidityStartDate;
                            // 如果存在范围，也可以设置 vValue2
                            vValue2 = null;
                        }
                        // } else if ( sField === "Plant") {
                        //     vValue1 = "1234";
                        //     // 如果存在范围，也可以设置 vValue2
                        //     vValue2 = null; 
                        // }

                        else {
                            vValue1 = cond.values && cond.values[0] !== undefined ? cond.values[0] : null;
                            vValue2 = cond.values && cond.values[1] !== undefined ? cond.values[1] : null;
                        }
                        var oFilter = new sap.ui.model.Filter(sField, sap.ui.model.FilterOperator.EQ, vValue1);
                        aFilters.push(oFilter);

                    });
                } else {
                    // 没有条件也生成 Filter，值为 null
                    aFilters.push(new sap.ui.model.Filter({
                        path: sField,
                        operator: sap.ui.model.FilterOperator.EQ,
                        value1: null
                    }));
                }
            });

            // aFilters.forEach(function(oFilter) {
            //     if (oFilter.sPath) {
            //         oFilter.sPath = oFilter.sPath.toUpperCase();
            //     }
            // });


            return aFilters;
        },

        printAction: function (items, sActionName) {
            var oBusyDialog = new BusyDialog();

            var promise = new Promise(function (resolve, reject) {
                var oAction = _oDataModel.bindContext("/BOM/com.sap.gateway.srvd.zui_bom_o4.v0001." + sActionName + "(...)");
                oAction.setParameter("Zzkey", JSON.stringify(items));
                oAction.setParameter("Event", "");
                oAction.setParameter("RecordUUID", "");

                oBusyDialog.open();

                oAction.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    oBusyDialog.close();
                    try {
                        var records = oAction.getBoundContext().getObject().value; //获取返回的数据
                    } catch (e) { }
                    resolve(records);
                }).catch((oError) => {
                    oBusyDialog.close();
                    messages.showError(oError.message);
                    reject(oError);
                });
            });
            return promise;
        },

    };
});
