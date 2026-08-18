sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
    "use strict";

    // UI5 FilterOperator -> ABAP range option 映射
    const OPERATOR_MAP = {
        "EQ": "EQ", "NE": "NE", "LT": "LT", "LE": "LE", "GT": "GT", "GE": "GE",
        "BT": "BT", "NB": "BT",
        "Contains": "CP", "NotContains": "CP", "StartsWith": "CP", "EndsWith": "CP"
    };

    return Base.extend("fico.zcogsadj.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._BusyDialog = new BusyDialog();
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zcogsadj-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zcogsadj-View"),
                        Confirm: aAllAccessBtns.some(btn => btn.AccessId === "zcogsadj-Confirm"),
                        Unconfirm: aAllAccessBtns.some(btn => btn.AccessId === "zcogsadj-UnConfirm"),
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "zcogsadj-Post"),
                        Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zcogsadj-Cancel")
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
                            text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        onAfterRendering: function () {
            this._setActionButtonsByExecFunction();
        },

        onSearch: function () {
            this._setActionButtonsByExecFunction();
        },

        onExecFunctionChange: function () {
            this._setActionButtonsByExecFunction();
        },

        // 营业确认状态显示文本: 1未确认 2已确认 3已取消确认
        formatConfirmStatus: function (v) {
            if (!v) { return ""; }
            var oBundle = this.getModel("i18n").getResourceBundle();
            return v + " - " + oBundle.getText("ConfStatus" + v);
        },

        // 过账状态显示文本: 1未过账 2已过账
        formatPostingStatus: function (v) {
            if (!v) { return ""; }
            var oBundle = this.getModel("i18n").getResourceBundle();
            return v + " - " + oBundle.getText("PstStatus" + v);
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            if (this._oDataModel.hasPendingChanges()) {
                this._oDataModel.resetChanges();
            }

            // 工厂权限校验
            if (!this._checkPlantAuthority()) {
                mBindingParams.preventTableBind = true;
                return;
            }

            // 年度/月份/执行功能是customControl, 手动补进filter
            var oGjahr = new Date(this.byId("idGjahr").getValue());
            mBindingParams.filters.push(new Filter("FiscalYear", FilterOperator.EQ, oGjahr.getFullYear()));

            var sMonat = this.byId("idMonat").getSelectedKey();
            mBindingParams.filters.push(new Filter("FiscalMonth", FilterOperator.EQ, "0" + sMonat));

            var sExec = this.byId("idExecFunction").getSelectedKey();
            mBindingParams.filters.push(new Filter("ExecFunction", FilterOperator.EQ, sExec));

            this._setActionButtonsByExecFunction();
        },

        // 工厂权限校验, 返回false=校验不通过(已弹错误框)
        _checkPlantAuthority: function () {
            var oSFB = this.byId("cogsAdjFilterBar");
            if (!oSFB) { return true; }

            var oBundle = this.getModel("i18n").getResourceBundle();
            var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet) {
                // 权限数据还没取回来, 先不拦(_initialize里失败会另行弹窗)
                return true;
            }

            var aPlants = this._getSelectedPlants();
            for (var i = 0; i < aPlants.length; i++) {
                var sPlant = aPlants[i];
                if (sPlant && !aAuthorityPlantSet.some(function (d) { return d.Plant === sPlant; })) {
                    MessageBox.error(oBundle.getText("noAuthorityPlant", [sPlant]));
                    return false;
                }
            }
            return true;
        },

        // 从SmartFilterBar取工厂的多值选择(items+ranges里的EQ值)
        _getSelectedPlants: function () {
            var oSFB = this.byId("cogsAdjFilterBar");
            var oFilterData = oSFB ? (oSFB.getFilterData() || {}) : {};
            var oPlant = oFilterData.Plant;
            var aPlants = [];

            if (!oPlant) { return aPlants; }
            if (oPlant.items) {
                oPlant.items.forEach(function (item) { aPlants.push(item.key); });
            }
            if (oPlant.ranges) {
                oPlant.ranges.forEach(function (r) {
                    if (r.operation === "EQ" && !r.exclude) { aPlants.push(r.value1); }
                });
            }
            if (oPlant.value) { aPlants.push(oPlant.value); }
            return aPlants;
        },

        //========================================================
        // 按执行功能切按钮:
        //   1更新 -> 营业确认/营业取消确认/财务过账
        //   2查询 -> 财务冲销
        //========================================================
        _setActionButtonsByExecFunction: function () {
            var oExecSelect = this.byId("idExecFunction");
            if (!oExecSelect) { return; }

            var bIsUpdate = oExecSelect.getSelectedKey() === "1";
            this.getModel("local").setProperty("/showUpdate", bIsUpdate);
            this.getModel("local").setProperty("/showCancel", !bIsUpdate);
        },

        // 营业确认: 后端重新取数拍快照落表并锁定, 同步执行完刷新列表
        onConfirm: function () {
            this._runFilterAction("CONFIRM", { refresh: true });
        },

        // 营业取消确认: 解锁, 同步执行完刷新列表
        onUnconfirm: function () {
            this._runFilterAction("UNCONFIRM", { refresh: true });
        },

        // 财务过账: 弹过账警示框, 确认后排JOB(异步, 不刷新)
        onPost: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();
            this._runFilterAction("POST", {
                confirmTitle: oBundle.getText("postConfirmTitle"),
                confirmMsg: oBundle.getText("postConfirmMsg")
            });
        },

        // 财务冲销: 弹冲销警示框, 确认后排JOB(异步, 不刷新)
        onCancel: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();
            this._runFilterAction("CANCEL", {
                confirmTitle: oBundle.getText("cancelConfirmTitle"),
                confirmMsg: oBundle.getText("cancelConfirmMsg")
            });
        },

        //========================================================
        // 四个按钮统一入口: 都按检索条件整批处理
        //   有confirmMsg的先弹警示框, 确认后才执行
        //========================================================
        _runFilterAction: function (sEvent, oOptions) {
            var oBundle = this.getModel("i18n").getResourceBundle();
            oOptions = oOptions || {};

            if (this._bRunning) { return; }

            if (!this._hasTableData()) {
                MessageBox.error(oBundle.getText("noDataMsg"));
                return;
            }

            if (!this._checkPlantAuthority()) { return; }

            var oPayload = this._buildFilterPayload();
            if (!oPayload) {
                MessageBox.error(oBundle.getText("filterIncompleteMsg"));
                return;
            }

            if (oOptions.confirmMsg) {
                MessageBox.confirm(oOptions.confirmMsg, {
                    title: oOptions.confirmTitle,
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._executeAction(sEvent, oPayload, oOptions.refresh);
                        }
                    }.bind(this)
                });
            } else {
                this._executeAction(sEvent, oPayload, oOptions.refresh);
            }
        },

        //========================================================
        // 调后端action
        //   CONFIRM/UNCONFIRM: 同步执行, 成功后刷新列表
        //   POST/CANCEL: 排JOB异步执行, 不刷新, 用户稍后重新GO看结果
        //========================================================
        _executeAction: function (sEvent, oPayload, bRefresh) {
            var that = this;

            this._bRunning = true;
            this._setActionButtonsEnabled(false);
            this._BusyDialog.open();

            this.postAction([JSON.stringify(oPayload)], sEvent).then(function (oData) {
                var oRes = oData && oData["processLogic"];

                // 后端校验失败/排程失败 -> 红框
                if (oRes && oRes.Event === "MESSAGE") {
                    MessageBox.error(oRes.Zzkey);
                    return;
                }

                MessageBox.information(oRes && oRes.Zzkey ? oRes.Zzkey : "");

                if (bRefresh) {
                    var oSmartTable = that.byId("cogsAdjTable");
                    if (oSmartTable) { oSmartTable.rebindTable(); }
                }
            }).catch(function (error) {
                MessageBox.error(error.message || error.responseText || String(error));
            }).finally(function () {
                that._bRunning = false;
                that._setActionButtonsEnabled(true);
                that._BusyDialog.close();
            });
        },

        _setActionButtonsEnabled: function (bEnabled) {
            ["btnConfirm", "btnUnconfirm", "btnPost", "btnCancel"].forEach(function (sId) {
                var oBtn = this.byId(sId);
                if (oBtn) { oBtn.setEnabled(bEnabled); }
            }.bind(this));
        },

        // 表格是否有数据(未查询/查询结果0条 -> false)
        _hasTableData: function () {
            var oTable = this.byId("tableCogsAdj");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oBinding) { return false; }
            return oBinding.getLength() > 0;
        },

        //========================================================
        // 检索条件payload, 与后端lhc_cogsadj的lty_filter对应:
        //   {
        //     "SalesOrganization": "2200",
        //     "Plant":       [{"sign":"I","option":"EQ","low":"2201","high":""}],
        //     "FiscalYear":  "2026",
        //     "FiscalMonth": "008"
        //   }
        //   条件不完整返回null
        //========================================================
        _buildFilterPayload: function () {
            var oSFB = this.byId("cogsAdjFilterBar");
            if (!oSFB) { return null; }

            var oFilterData = oSFB.getFilterData() || {};
            var sSalesOrg = oFilterData.SalesOrganization;

            var aPlantRanges = this._buildPlantRanges(oFilterData.Plant);

            var oGjahrCtl = this.byId("idGjahr");
            var sGjahr = "";
            if (oGjahrCtl && oGjahrCtl.getValue()) {
                var oGjahrDate = new Date(oGjahrCtl.getValue());
                if (!isNaN(oGjahrDate.getTime())) {
                    sGjahr = String(oGjahrDate.getFullYear());
                }
            }

            var oMonatCtl = this.byId("idMonat");
            var sMonat = oMonatCtl ? oMonatCtl.getSelectedKey() : "";

            if (!sSalesOrg || aPlantRanges.length === 0 || !sGjahr || !sMonat) {
                return null;
            }

            return {
                SalesOrganization: sSalesOrg,
                Plant: aPlantRanges,
                FiscalYear: sGjahr,
                FiscalMonth: "0" + sMonat
            };
        },

        // 工厂多值 -> ABAP range数组
        _buildPlantRanges: function (oPlant) {
            var aRanges = [];
            if (!oPlant) { return aRanges; }

            if (oPlant.items) {
                oPlant.items.forEach(function (item) {
                    aRanges.push({ sign: "I", option: "EQ", low: item.key, high: "" });
                });
            }
            if (oPlant.ranges) {
                oPlant.ranges.forEach(function (r) {
                    aRanges.push({
                        sign: r.exclude ? "E" : "I",
                        option: OPERATOR_MAP[r.operation] || "EQ",
                        low: r.value1,
                        high: r.value2 || ""
                    });
                });
            }
            if (oPlant.value) {
                aRanges.push({ sign: "I", option: "EQ", low: oPlant.value, high: "" });
            }
            return aRanges;
        },

        postAction: function (postData, bEvent) {
            return new Promise(function (resolve, reject) {
                var mParameter = {
                    success: function (oData, response) { resolve(oData); },
                    error: function (oError) { reject(oError); },
                    method: "POST",
                    urlParameters: {
                        Zzkey: postData,
                        Event: bEvent
                    }
                };
                this.getModel().callFunction("/processLogic", mParameter);
            }.bind(this));
        }
    });
});