sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
    "use strict";

    return Base.extend("fico.zprocfeetrf.controller.Main", {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-View")) {
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
                        View:   aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-View"),
                        Post:   aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-Post"),
                        Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-Cancel")
                    },
                    data: {
                        PlantSet:   context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet:    context._AssignRole
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
            this._setActionButtonsByPostingStatus();
        },

        onSearch: function () {
            this._setActionButtonsByPostingStatus();
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            if (this._oDataModel.hasPendingChanges()) {
                this._oDataModel.resetChanges();
            }

            // 公司代码权限校验
            var sBukrs = this.byId("SFBProcFeeTrf").getFilterData().CompanyCode;
            var aAuthorityCompanySet = this.getModel("local").getProperty("/authorityCheck/data/CompanySet");
            if (!aAuthorityCompanySet.some(data => data.CompanyCode === sBukrs)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityCompanyCode", [sBukrs]));
                mBindingParams.preventTableBind = true;
                return;
            }

            // 自定义筛选条件：PostingStatus
            var sPostingStatus = this.byId("PostingStatusSelect").getSelectedKey();
            this._removeFilterByPath(mBindingParams.filters, "PostingStatus");
            if (sPostingStatus) {
                mBindingParams.filters.push(new Filter("PostingStatus", FilterOperator.EQ, sPostingStatus));
            }

            // 自定义筛选条件：FiscalYear
            var oGjahr = new Date(this.byId("idGjahr").getValue());
            mBindingParams.filters.push(new Filter("FiscalYear", FilterOperator.EQ, oGjahr.getFullYear()));

            // 自定义筛选条件：FiscalPeriod
            var sMonat = this.byId("idMonat").getSelectedKey();
            mBindingParams.filters.push(new Filter("FiscalPeriod", FilterOperator.EQ, sMonat));

            this._setActionButtonsByPostingStatus();
        },

        _removeFilterByPath: function (aFilters, sPath) {
            for (var i = aFilters.length - 1; i >= 0; i--) {
                if (aFilters[i].sPath === sPath) {
                    aFilters.splice(i, 1);
                }
            }
        },

        onPostingStatusChange: function () {
            this._setActionButtonsByPostingStatus();
        },

        _setActionButtonsByPostingStatus: function () {
            var oStatusSelect  = this.byId("PostingStatusSelect");
            var oPostButton    = this.byId("btnPostJob");
            var oCancelButton  = this.byId("btnCancelJob");

            if (!oStatusSelect || !oPostButton || !oCancelButton) {
                return;
            }

            var sPostingStatus = oStatusSelect.getSelectedKey();
            oPostButton.setVisible(sPostingStatus === "1");
            oCancelButton.setVisible(sPostingStatus === "2");
        },

        //========================================================
        // ★【改动】过账JOB：不选行，把检索条件传给后端排JOB
        //   弹窗消息 = 原过账确认消息 + JOB说明（原文未改动，只在后面追加）
        //========================================================
        onPostJob: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();

            // 防重复点击
            if (this._bRunning) { return; }

            if (!this._hasTableData()) {
                MessageBox.error(oBundle.getText("noDataMsg"));
                return;
            }

            // 公司代码权限校验（防止查询后改了公司代码再点）
            if (!this._checkCompanyAuthority()) { return; }

            var oPayload = this._buildFilterPayload();
            if (!oPayload) {
                MessageBox.error(oBundle.getText("filterIncompleteMsg"));
                return;
            }

            MessageBox.confirm(
                oBundle.getText("postConfirmMsg") + "\n" + oBundle.getText("jobAppendMsg"),
                {
                    title: oBundle.getText("postConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._executeAction("POST", oPayload);
                        }
                    }.bind(this)
                }
            );
        },

        //========================================================
        // ★【改动】冲销JOB：同样不选行，按检索条件冲销该期间全部已过账凭证
        //   后端会先同步校验有无可冲销记录，通过后才排JOB
        //   弹窗消息 = 原冲销确认消息 + JOB说明（原文未改动，只在后面追加）
        //========================================================
        onCancelJob: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();

            if (this._bRunning) { return; }

            if (!this._hasTableData()) {
                MessageBox.error(oBundle.getText("noDataMsg"));
                return;
            }

            if (!this._checkCompanyAuthority()) { return; }

            var oPayload = this._buildFilterPayload();
            if (!oPayload) {
                MessageBox.error(oBundle.getText("filterIncompleteMsg"));
                return;
            }

            MessageBox.confirm(
                oBundle.getText("cancelConfirmMsg") + "\n" + oBundle.getText("jobAppendMsg"),
                {
                    title: oBundle.getText("cancelConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._executeAction("CANCEL", oPayload);
                        }
                    }.bind(this)
                }
            );
        },

        // ★【改动】表格是否有数据（未查询 / 查询结果0条 → false）
        _hasTableData: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oBinding) { return false; }
            return oBinding.getLength() > 0;
        },

        // ★【改动】公司代码权限校验（与 onBeforeRebindTable 里的校验一致）
        _checkCompanyAuthority: function () {
            var sBukrs = this.byId("SFBProcFeeTrf").getFilterData().CompanyCode;
            var aAuthorityCompanySet = this.getModel("local").getProperty("/authorityCheck/data/CompanySet") || [];
            if (!aAuthorityCompanySet.some(function (data) { return data.CompanyCode === sBukrs; })) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("noAuthorityCompanyCode", [sBukrs]));
                return false;
            }
            return true;
        },

        //========================================================
        // ★【改动】排JOB的payload：从 SmartFilterBar / 自定义控件读检索条件
        //   {
        //     "CompanyCode":       "2200",
        //     "TargetCompanyCode": "2000",
        //     "FiscalYear":        "2026",
        //     "FiscalPeriod":      "04"
        //   }
        //   条件不完整返回 null（目标公司代码可空，后端默认2000）
        //========================================================
        _buildFilterPayload: function () {
            var oSFB = this.byId("SFBProcFeeTrf");
            if (!oSFB) { return null; }

            var oFilterData = oSFB.getFilterData() || {};
            var sCompany    = oFilterData.CompanyCode;
            var sTargetCC   = oFilterData.TargetCompanyCode || "";

            // 年度/期间是 customControl，不在 getFilterData 里
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

            if (!sCompany || !sGjahr || !sMonat) {
                return null;
            }

            return {
                CompanyCode:       sCompany,
                TargetCompanyCode: sTargetCC,
                FiscalYear:        sGjahr,
                FiscalPeriod:      sMonat
            };
        },

        //========================================================
        // ★【改动】调后端排JOB
        //   JOB是异步的，排完后 ZTFI_1034 还没结果，所以【不刷新列表】
        //   用户稍后重新点 GO 就能看到执行结果
        //========================================================
        _executeAction: function (sEvent, oPayload) {
            var that = this;

            this._bRunning = true;
            this._setActionButtonsEnabled(false);
            this._BusyDialog.open();

            this.postAction([JSON.stringify(oPayload)], sEvent).then(function (oData) {
                var oRes = oData && oData["processLogic"];

                // 后端校验失败 / 排程失败 → 红框
                if (oRes && oRes.Event === "MESSAGE") {
                    MessageBox.error(oRes.Zzkey);
                    return;
                }

                MessageBox.information(oRes && oRes.Zzkey ? oRes.Zzkey : "");
            }).catch(function (error) {
                MessageBox.error(error.message || error.responseText || String(error));
            }).finally(function () {
                that._bRunning = false;
                that._setActionButtonsEnabled(true);
                that._BusyDialog.close();
            });
        },

        _setActionButtonsEnabled: function (bEnabled) {
            var oPost   = this.byId("btnPostJob");
            var oCancel = this.byId("btnCancelJob");
            if (oPost)   { oPost.setEnabled(bEnabled); }
            if (oCancel) { oCancel.setEnabled(bEnabled); }
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
    });
});