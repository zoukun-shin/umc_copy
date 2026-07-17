sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
    "use strict";

    const ENTITY_SET = "MpnMovAvgPrice";

    //  UI5 FilterOperator → ABAP range option 映射
    const OPERATOR_MAP = {
        "EQ":         "EQ",
        "NE":         "NE",
        "LT":         "LT",
        "LE":         "LE",
        "GT":         "GT",
        "GE":         "GE",
        "BT":         "BT",
        "NB":         "BT",   // NotBetween → sign=E + option=BT
        "Contains":   "CP",
        "NotContains":"CP",   // → sign=E
        "StartsWith": "CP",
        "EndsWith":   "CP"
    };

    return Base.extend("fico.zmpnmovavgprice.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._BusyDialog = new BusyDialog();
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail(); 
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignPlant,_AssignRole($expand=_UserRoleAccessBtn)"
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zmpnmovavgprice-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View:   aAllAccessBtns.some(btn => btn.AccessId === "zmpnmovavgprice-View"),
                        Update: aAllAccessBtns.some(btn => btn.AccessId === "zmpnmovavgprice-Update")
                    },
                    data: {
                        PlantSet: context._AssignPlant
                    }
                });
            }.bind(this), function (oError) {
                if (!this.oErrorMessageDialog) {
                    this.oErrorMessageDialog = new sap.m.Dialog({
                        type: sap.m.DialogType.Message,
                        state: "Error",
                        content: new sap.m.Text({
                            text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        onAfterRendering: function () {
            this._setActionButtonsByUpdateMode();
        },

        onSearch: function () {
            this._setActionButtonsByUpdateMode();
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            if (this._oDataModel.hasPendingChanges()) {
                this._oDataModel.resetChanges();
            }

            //  工厂权限校验（工厂 + 目标工厂都要校验）
            if (!this._checkPlantAuthority()) {
                mBindingParams.preventTableBind = true;
                return;
            }

            // 本次过账日期（单值，自定义 DatePicker）
            var oPostingDate = this.byId("idPostingDate");
            this._removeFilterByPath(mBindingParams.filters, "CurrentPostingDate");
            if (oPostingDate && oPostingDate.getDateValue()) {
                mBindingParams.filters.push(new Filter("CurrentPostingDate", FilterOperator.EQ,
                    this._toEdmDate(oPostingDate.getDateValue())));
            }

            // 创建日期区间（可选可多选，自定义 DateRangeSelection）
            var oCreatedOn = this.byId("idCreatedOn");
            this._removeFilterByPath(mBindingParams.filters, "CreatedOnFilter");
            if (oCreatedOn && oCreatedOn.getDateValue()) {
                mBindingParams.filters.push(new Filter({
                    path: "CreatedOnFilter",
                    operator: FilterOperator.BT,
                    value1: this._toEdmDate(oCreatedOn.getDateValue()),
                    value2: this._toEdmDate(oCreatedOn.getSecondDateValue() || oCreatedOn.getDateValue())
                }));
            }

            // 更新方式（单值，自定义 ComboBox）
            var oUpdateMode = this.byId("idUpdateMode");
            this._removeFilterByPath(mBindingParams.filters, "UpdateMode");
            if (oUpdateMode && oUpdateMode.getSelectedKey()) {
                mBindingParams.filters.push(new Filter("UpdateMode", FilterOperator.EQ, oUpdateMode.getSelectedKey()));
            }

            this._setActionButtonsByUpdateMode();
        },

        //  工厂权限校验：工厂 / 目标工厂 都必须在用户被授权的工厂清单里
        //   返回 false = 校验不通过（已弹错误框），调用方应阻止取数
        _checkPlantAuthority: function () {
            var oSFB = this.byId("SFBMpnMovAvgPrice");
            if (!oSFB) { return true; }

            var oFilterData = oSFB.getFilterData() || {};
            var oBundle     = this.getModel("i18n").getResourceBundle();

            var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet) {
                // 权限数据还没取回来，先不拦（_initialize 里失败会另行弹窗）
                return true;
            }

            // 工厂（必输单选）
            var sPlant = oFilterData.Plant;
            if (sPlant && !aAuthorityPlantSet.some(function (d) { return d.Plant === sPlant; })) {
                MessageBox.error(oBundle.getText("noAuthorityPlant", [sPlant]));
                return false;
            }

            // 目标工厂（必输单选）
            var sTargetPlant = oFilterData.TargetPlant;
            if (sTargetPlant && !aAuthorityPlantSet.some(function (d) { return d.Plant === sTargetPlant; })) {
                MessageBox.error(oBundle.getText("noAuthorityTargetPlant", [sTargetPlant]));
                return false;
            }

            return true;
        },

        // Edm.DateTime + display-format="Date"：需要 UTC 零点的 Date，
        // 否则 GMT+8 的本地零点会被转成 UTC 前一天 16:00，日期错一天。
        // 用当天 年/月/日 重建成 UTC 零点。
        _toEdmDate: function (oLocalDate) {
            if (!oLocalDate) { return oLocalDate; }
            return new Date(Date.UTC(
                oLocalDate.getFullYear(),
                oLocalDate.getMonth(),
                oLocalDate.getDate(), 0, 0, 0, 0
            ));
        },

        _removeFilterByPath: function (aFilters, sPath) {
            for (var i = aFilters.length - 1; i >= 0; i--) {
                if (aFilters[i].sPath === sPath) {
                    aFilters.splice(i, 1);
                }
            }
        },

        onUpdateModeChange: function () {
            this._setActionButtonsByUpdateMode();
        },

        // 更新方式=2（更新）才显示更新/更新JOB按钮；=1（查询）隐藏
        // 更新方式=2（更新）：显示更新/更新JOB按钮，隐藏「创建日期」，五个检索条件必输
        // 更新方式=1（查询）：隐藏按钮，显示「创建日期」，只有「工厂」必输
        // 「创建日期」过滤的是 ZTFI_1036 历史日志的创建时间，只对查询模式有意义；
        //   更新模式是实时取数+改价，不接收该条件，故隐藏避免误导
        _setActionButtonsByUpdateMode: function () {
            var oModeSelect   = this.byId("idUpdateMode");
            var oUpdateButton = this.byId("btnUpdate");
            var oJobButton    = this.byId("btnUpdateJob");

            if (!oModeSelect) {
                return;
            }

            var bIsUpdateMode = oModeSelect.getSelectedKey() === "2";

            if (oUpdateButton) { oUpdateButton.setVisible(bIsUpdateMode); }
            if (oJobButton)    { oJobButton.setVisible(bIsUpdateMode); }

            this._setCreatedOnFilterVisible(!bIsUpdateMode);
            this._setMandatoryByUpdateMode(bIsUpdateMode);
        },

        //  按更新方式动态切换必输：
        //   更新方式=2（更新）：物料/工厂/采购组织/目标工厂/本次过账日期 全必输
        //   更新方式=1（查询）：只有「工厂」必输，其余可选
        //   ※ 切换时不清空已填的值
        _setMandatoryByUpdateMode: function (bIsUpdateMode) {
            var oSFB = this.byId("SFBMpnMovAvgPrice");
            if (!oSFB) { return; }

            var that = this;

            // 查询模式下仍必输的字段（避免全表扫描）
            var aAlwaysMandatory = ["Plant"];

            var aFields = ["Product", "Plant", "PurchasingOrganization",
                           "TargetPlant", "CurrentPostingDate"];

            aFields.forEach(function (sName) {
                var oItem = that._getFilterItemByName(sName);
                if (!oItem || typeof oItem.setMandatory !== "function") { return; }

                var bMandatory = bIsUpdateMode || aAlwaysMandatory.indexOf(sName) !== -1;
                oItem.setMandatory(bMandatory);

                 // 变成非必输时，清掉之前校验留下的红框
                if (!bMandatory) {
                    var oControl = oItem.getControl && oItem.getControl();
                    if (oControl && typeof oControl.setValueState === "function") {
                        oControl.setValueState("None");
                        if (typeof oControl.setValueStateText === "function") {
                            oControl.setValueStateText("");
                        }
                    }
                }
            });
        },

        //  取 SmartFilterBar 的筛选项（不同 UI5 版本 API 名不同，做个兼容）
        _getFilterItemByName: function (sName) {
            var oSFB = this.byId("SFBMpnMovAvgPrice");
            if (!oSFB) { return null; }

            if (typeof oSFB.determineFilterItemByName === "function") {
                return oSFB.determineFilterItemByName(sName);
            }
            if (typeof oSFB.getFilterItemByName === "function") {
                return oSFB.getFilterItemByName(sName);
            }
            return null;
        },

        //  整组显示/隐藏「创建日期」筛选项（label + 控件一起）
        //   注：不清空已填的值，切回查询模式时还在
        _setCreatedOnFilterVisible: function (bVisible) {
            var oFilterItem = this._getFilterItemByName("CreatedOnFilter");

            if (oFilterItem && typeof oFilterItem.setVisible === "function") {
                oFilterItem.setVisible(bVisible);
                return;
            }

            // 兜底：整组拿不到就只隐藏控件本身（label 会留下）
            var oCreatedOn = this.byId("idCreatedOn");
            if (oCreatedOn) { oCreatedOn.setVisible(bVisible); }
        },

        //========================================================
        //  更新：不再选行，直接弹窗确认「是否全选更新」，
        //   确认后把 SmartFilterBar 的检索条件(range)传给后端
        //========================================================
        onUpdate: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();

            // 防重复点击：执行中直接忽略
            if (this._bUpdating) {
                return;
            }

            //  表格没有数据时不允许更新（未查询 / 查询结果为0条）
            if (!this._hasTableData()) {
                MessageBox.error(oBundle.getText("noDataMsg"));
                return;
            }

            //  工厂权限校验（防止用户查询后改了工厂再点更新）
            if (!this._checkPlantAuthority()) {
                return;
            }

            // 先校验检索条件是否完整
            var oFilterPayload = this._buildFilterPayload();
            if (!oFilterPayload) {
                MessageBox.error(oBundle.getText("filterIncompleteMsg"));
                return;
            }

            MessageBox.confirm(
                oBundle.getText("updateConfirmMsg"),
                {
                    title: oBundle.getText("updateConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._executeAction("CHANGE", oFilterPayload, true);
                        }
                    }.bind(this)
                }
            );
        },

        //========================================================
        //  更新JOB：不立即改价，只让后端排一个后台JOB
        //   传给后端的 filter range 与「更新」完全一致，只是 Event = "JOB"
        //   JOB 是异步的，排完后 ZTFI_1036 还没数据，所以【不刷新列表】
        //========================================================
        onUpdateJob: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();

            // 防重复点击：执行中直接忽略
            if (this._bUpdating) {
                return;
            }

            // 表格没有数据时不允许排JOB（未查询 / 查询结果为0条）
            if (!this._hasTableData()) {
                MessageBox.error(oBundle.getText("noDataMsg"));
                return;
            }

            //  工厂权限校验（防止用户查询后改了工厂再点更新JOB）
            if (!this._checkPlantAuthority()) {
                return;
            }

            var oFilterPayload = this._buildFilterPayload();
            if (!oFilterPayload) {
                MessageBox.error(oBundle.getText("filterIncompleteMsg"));
                return;
            }

            MessageBox.confirm(
                oBundle.getText("updateJobConfirmMsg"),
                {
                    title: oBundle.getText("updateJobConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            // bRefresh = false：JOB是异步的，刷新也看不到结果
                            this._executeAction("JOB", oFilterPayload, false);
                        }
                    }.bind(this)
                }
            );
        },

        // sEvent    : "CHANGE"（立即改价）/ "JOB"（排后台JOB）
        // bRefresh  : 执行完是否重新触发 go（JOB 传 false）
        _executeAction: function (sEvent, oFilterPayload, bRefresh) {
            var that = this;

            this._bUpdating = true;
            this._setUpdateButtonEnabled(false);
            this._BusyDialog.open();

            this.postAction([JSON.stringify(oFilterPayload)], sEvent).then(function (oData) {
                var oRes = oData && oData["processLogic"];

                if (oRes && oRes.Event === "MESSAGE") {
                    MessageBox.error(oRes.Zzkey);
                    return;
                }

                //  后端只回一句执行摘要；
                //   CHANGE：明细靠重新触发 go 从 ZTFI_1036 读回来
                //           （ZCL 更新方式=2 会把最近一次执行的 Status/Message 回填到每一行）
                //   JOB   ：异步执行，此时还没有结果，不刷新
                MessageBox.information(oRes && oRes.Zzkey ? oRes.Zzkey : "", {
                    onClose: function () {
                        if (bRefresh !== false) {
                            that._refreshTable();
                        }
                    }
                });
            }).catch(function (error) {
                MessageBox.error(error.message || error.responseText || String(error));
            }).finally(function () {
                that._bUpdating = false;
                that._setUpdateButtonEnabled(true);
                that._BusyDialog.close();
            });
        },

        //  表格是否有数据（未查询 / 查询结果0条 → false）
        _hasTableData: function () {
            var oTable   = this.byId("Table_MpnMovAvgPrice");
            var oBinding = oTable && oTable.getBinding("rows");

            if (!oBinding) {
                return false;   // 还没查询过，binding 都没建立
            }

            return oBinding.getLength() > 0;
        },

        _setUpdateButtonEnabled: function (bEnabled) {
            var oBtn = this.byId("btnUpdate");
            var oJob = this.byId("btnUpdateJob");
            if (oBtn) { oBtn.setEnabled(bEnabled); }
            if (oJob) { oJob.setEnabled(bEnabled); }
        },

        //  执行完重新触发 go（等同于用户再点一次查询）
        _refreshTable: function () {
            var oSmartTable = this.byId("smartTable_MpnMovAvgPrice");
            if (oSmartTable) {
                oSmartTable.rebindTable();
            }
        },

        //========================================================
        //  从 SmartFilterBar 读出检索条件，转成后端能吃的 range 结构
        //   {
        //     "Plant":                  [{"sign":"I","option":"EQ","low":"1100","high":""}],
        //     "TargetPlant":            [...],
        //     "PurchasingOrganization": [...],
        //     "Product":                [{"sign":"I","option":"EQ","low":"物料A","high":""},
        //                                {"sign":"I","option":"CP","low":"00-*","high":""}],
        //     "PostingDate":            "20260715"
        //   }
        //   条件不完整返回 null
        //========================================================
        _buildFilterPayload: function () {
            var oSFB = this.byId("SFBMpnMovAvgPrice");
            if (!oSFB) { return null; }

            var aFilters = oSFB.getFilters() || [];

            var oPayload = {
                Plant:                  this._extractRange(aFilters, "Plant"),
                TargetPlant:            this._extractRange(aFilters, "TargetPlant"),
                PurchasingOrganization: this._extractRange(aFilters, "PurchasingOrganization"),
                Product:                this._extractRange(aFilters, "Product"),
                PostingDate:            ""
            };

            // 本次过账日期（自定义 DatePicker，不在 getFilters() 里）
            var oPostingDate = this.byId("idPostingDate");
            if (oPostingDate && oPostingDate.getDateValue()) {
                oPayload.PostingDate = this._toAbapDate(oPostingDate.getDateValue());
            }

            // 必输校验：四个 range + 过账日期都不能空
            if (oPayload.Plant.length === 0 ||
                oPayload.TargetPlant.length === 0 ||
                oPayload.PurchasingOrganization.length === 0 ||
                oPayload.Product.length === 0 ||
                !oPayload.PostingDate) {
                return null;
            }

            return oPayload;
        },

        // 从 SmartFilterBar 的 Filter 树里把指定字段的条件抽成 ABAP range 数组
        _extractRange: function (aFilters, sPath) {
            var aRange = [];
            var that = this;

            function walk(oFilter) {
                if (!oFilter) { return; }

                // 组合 Filter（aFilters 子节点）
                if (oFilter.aFilters && oFilter.aFilters.length > 0) {
                    oFilter.aFilters.forEach(walk);
                    return;
                }

                if (oFilter.sPath !== sPath) { return; }

                var oRangeItem = that._filterToRange(oFilter);
                if (oRangeItem) {
                    aRange.push(oRangeItem);
                }
            }

            aFilters.forEach(walk);
            return aRange;
        },

        _filterToRange: function (oFilter) {
            var sOperator = oFilter.sOperator;
            var sOption   = OPERATOR_MAP[sOperator];

            if (!sOption) { return null; }

            // 排除型条件：NotBetween / NotContains / NE
            var sSign = (sOperator === "NB" || sOperator === "NotContains") ? "E" : "I";

            var sLow  = this._normalizeValue(oFilter.oValue1);
            var sHigh = this._normalizeValue(oFilter.oValue2);

            // 通配符补全
            if (sOperator === "Contains" || sOperator === "NotContains") {
                sLow = "*" + sLow + "*";
            } else if (sOperator === "StartsWith") {
                sLow = sLow + "*";
            } else if (sOperator === "EndsWith") {
                sLow = "*" + sLow;
            }

            if (!sLow) { return null; }

            return {
                sign:   sSign,
                option: sOption,
                low:    sLow,
                high:   sHigh || ""
            };
        },

        _normalizeValue: function (vValue) {
            if (vValue === undefined || vValue === null) { return ""; }
            if (vValue instanceof Date) { return this._toAbapDate(vValue); }
            return String(vValue);
        },

        // Date → ABAP 的 YYYYMMDD
        _toAbapDate: function (oDate) {
            if (!oDate) { return ""; }
            var sYear  = String(oDate.getFullYear());
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sDay   = ("0" + oDate.getDate()).slice(-2);
            return sYear + sMonth + sDay;
        },

        postAction: function (postData, bEvent) {
            return new Promise(function (resolve, reject) {
                this.getModel().callFunction("/processLogic", {
                    success: function (oData) { resolve(oData); },
                    error:   function (oError) { reject(oError); },
                    method:  "POST",
                    urlParameters: {
                        Zzkey: postData,
                        Event: bEvent
                    }
                });
            }.bind(this));
        }

        //========================================================
        //  以下为旧版「执行后直接回写前端 Status/Message」的逻辑，
        //   现已改为「执行后重新触发 go，由 ZCL 更新方式=2 从 ZTFI_1036
        //   回填最近一次执行结果」，故整段保留但不再调用。
        //   如需回退到直接回写方式，把 _executeAction 里的
        //   this._refreshTable() 换成调用 _writeBackResult(aResult) 即可。
        //========================================================
        /*
        _writeBackResult: function (aResult) {
            aResult.forEach(function (line) {
                var sKey = this._buildEntityKey(line);
                if (!sKey) { return; }

                this._setIfExists(sKey, "Status",  line.STATUS  || line.Status);
                this._setIfExists(sKey, "Message", line.MESSAGE || line.Message);
                this._setIfExists(sKey, "Ledger",  line.LEDGER  || line.Ledger);

                this._setIfExists(sKey, "Mpn",                        line.MPN                        || line.Mpn);
                this._setIfExists(sKey, "ProductName",                line.PRODUCTNAME                || line.ProductName);
                this._setIfExists(sKey, "PurchasingInfoRecord",       line.PURCHASINGINFORECORD       || line.PurchasingInfoRecord);
                this._setIfExists(sKey, "Supplier",                   line.SUPPLIER                   || line.Supplier);
                this._setIfExists(sKey, "PurchasingInfoRecordPrice",  line.PURCHASINGINFORECORDPRICE  || line.PurchasingInfoRecordPrice);
                this._setIfExists(sKey, "PurchInfoRecPriceCrcy",      line.PURCHINFORECPRICECRCY      || line.PurchInfoRecPriceCrcy);

                //  三币别：变更价格 / 币别 / 移动平均价 / 价格单位
                this._setIfExists(sKey, "ChangedPriceCc",             line.CHANGEDPRICECC             || line.ChangedPriceCc);
                this._setIfExists(sKey, "ChangedPriceGrp",            line.CHANGEDPRICEGRP            || line.ChangedPriceGrp);
                this._setIfExists(sKey, "ChangedPriceFun",            line.CHANGEDPRICEFUN            || line.ChangedPriceFun);
                this._setIfExists(sKey, "CurrencyCc",                 line.CURRENCYCC                 || line.CurrencyCc);
                this._setIfExists(sKey, "CurrencyGrp",                line.CURRENCYGRP                || line.CurrencyGrp);
                this._setIfExists(sKey, "CurrencyFun",                line.CURRENCYFUN                || line.CurrencyFun);
                this._setIfExists(sKey, "MovingAveragePriceCc",       line.MOVINGAVERAGEPRICECC       || line.MovingAveragePriceCc);
                this._setIfExists(sKey, "MovingAveragePriceGrp",      line.MOVINGAVERAGEPRICEGRP      || line.MovingAveragePriceGrp);
                this._setIfExists(sKey, "MovingAveragePriceFun",      line.MOVINGAVERAGEPRICEFUN      || line.MovingAveragePriceFun);
                this._setIfExists(sKey, "PriceUnitCc",                line.PRICEUNITCC                || line.PriceUnitCc);
                this._setIfExists(sKey, "PriceUnitGrp",               line.PRICEUNITGRP               || line.PriceUnitGrp);
                this._setIfExists(sKey, "PriceUnitFun",               line.PRICEUNITFUN               || line.PriceUnitFun);

                this._setIfExists(sKey, "TargetPlantStockIndicator",  line.TARGETPLANTSTOCKINDICATOR  || line.TargetPlantStockIndicator);
                this._setIfExists(sKey, "PostingDate",                line.POSTINGDATE                || line.PostingDate);

                this._setIfExists(sKey, "ChangeDocumentCc",           line.CHANGEDOCUMENTCC           || line.ChangeDocumentCc);
                this._setIfExists(sKey, "ChangeDocYearCc",            line.CHANGEDOCYEARCC            || line.ChangeDocYearCc);
                this._setIfExists(sKey, "ChangeDocumentGrp",          line.CHANGEDOCUMENTGRP          || line.ChangeDocumentGrp);
                this._setIfExists(sKey, "ChangeDocYearGrp",           line.CHANGEDOCYEARGRP           || line.ChangeDocYearGrp);
                this._setIfExists(sKey, "ChangeDocumentFun",          line.CHANGEDOCUMENTFUN          || line.ChangeDocumentFun);
                this._setIfExists(sKey, "ChangeDocYearFun",           line.CHANGEDOCYEARFUN           || line.ChangeDocYearFun);
            }, this);
        },

        _setIfExists: function (sKey, sProperty, vValue) {
            if (vValue !== undefined && vValue !== null) {
                this._oDataModel.setProperty(sKey + "/" + sProperty, vValue);
            }
        },

        _buildEntityKey: function (line) {
            var sProduct      = line.PRODUCT      || line.Product      || line.OWNINVENTORYMANAGEDPRODUCT || line.OwninventoryManagedProduct;
            var sPlant        = line.PLANT        || line.Plant;
            var sPurOrg       = line.PURCHASINGORGANIZATION || line.PurchasingOrganization;
            var sTargetPlant  = line.TARGETPLANT  || line.TargetPlant;
            var sLedger       = line.LEDGER       || line.Ledger;

            if (!sProduct || !sPlant || !sPurOrg || !sTargetPlant || !sLedger) {
                return "";
            }

            // Ledger 已进 Key（一个 工厂+物料 有 0L/2L 两行）
            return "/" + ENTITY_SET +
                "(Product='"                 + sProduct     +
                "',Plant='"                  + sPlant       +
                "',PurchasingOrganization='" + sPurOrg      +
                "',TargetPlant='"            + sTargetPlant +
                "',Ledger='"                 + sLedger      +
                "')";
        }
        */

    });
});