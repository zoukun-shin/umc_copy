sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
    "use strict";

    const ENTITY_SET = "ProxyJournal";

    // ★ UI5 FilterOperator → ABAP range option 映射
    const OPERATOR_MAP = {
        "EQ": "EQ", "NE": "NE", "LT": "LT", "LE": "LE", "GT": "GT", "GE": "GE",
        "BT": "BT", "NB": "BT",
        "Contains": "CP", "NotContains": "CP", "StartsWith": "CP", "EndsWith": "CP"
    };

    return Base.extend("fico.zproxyjournal.controller.Main", {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zproxyjournal-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zproxyjournal-View"),
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "zproxyjournal-Post"),
                        Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zproxyjournal-Cancel")
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
            if (!this._checkCompanyAuthority()) {
                mBindingParams.preventTableBind = true;
                return;
            }

            var sPostingStatus = this.byId("PostingStatusSelect").getSelectedKey();
            this._removeFilterByPath(mBindingParams.filters, "PostingStatus");

            if (sPostingStatus) {
                mBindingParams.filters.push(
                    new Filter("PostingStatus", FilterOperator.EQ, sPostingStatus)
                );
            }
            var oGjahr = new Date(this.byId("idGjahr").getValue());
            var oGjahrFilter = new Filter("FiscalYear", FilterOperator.EQ, oGjahr.getFullYear());
            mBindingParams.filters.push(oGjahrFilter);

            var sMonat = this.byId("idMonat").getSelectedKey();
            var oMonatFilter = new Filter("FiscalPeriod", FilterOperator.EQ, sMonat);
            mBindingParams.filters.push(oMonatFilter);

            this._setActionButtonsByPostingStatus();
        },

        // ★ 公司代码权限校验（原公司 + 目标公司）
        //   返回 false = 校验不通过（已弹错误框）
        _checkCompanyAuthority: function () {
            var oSFB = this.byId("SFBProxyJournal");
            if (!oSFB) { return true; }

            var oFilterData = oSFB.getFilterData() || {};
            var oBundle     = this.getModel("i18n").getResourceBundle();

            var aAuthorityCompanySet = this.getModel("local").getProperty("/authorityCheck/data/CompanySet");
            if (!aAuthorityCompanySet) {
                // 权限数据还没取回来，先不拦（_initialize 里失败会另行弹窗）
                return true;
            }

            var sBukrs = oFilterData.SourceCompanyCode;
            if (sBukrs && !aAuthorityCompanySet.some(function (d) { return d.CompanyCode === sBukrs; })) {
                MessageBox.error(oBundle.getText("noAuthorityCompanyCode", [sBukrs]));
                return false;
            }

            var sTargetBukrs = oFilterData.TargetCompanyCode;
            if (sTargetBukrs && !aAuthorityCompanySet.some(function (d) { return d.CompanyCode === sTargetBukrs; })) {
                MessageBox.error(oBundle.getText("noAuthorityCompanyCode", [sTargetBukrs]));
                return false;
            }

            return true;
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

        //========================================================
        // ★ 按过账状态切按钮 + 切表格选择模式
        //   状态=1（未过账）→ 过账JOB按钮，表格不选行（传filter）
        //   状态=2（已过账）→ 冲销JOB按钮，表格要选一行（传创建日期）
        //========================================================
        _setActionButtonsByPostingStatus: function () {
            var oStatusSelect = this.byId("PostingStatusSelect");
            var oPostButton   = this.byId("btnPostJob");
            var oCancelButton = this.byId("btnCancelJob");
            var oTable        = this.byId("Table_ProxyJournal");

            if (!oStatusSelect) { return; }

            var sPostingStatus = oStatusSelect.getSelectedKey();
            var bIsPost   = sPostingStatus === "1";
            var bIsCancel = sPostingStatus === "2";

            if (oPostButton)   { oPostButton.setVisible(bIsPost); }
            if (oCancelButton) { oCancelButton.setVisible(bIsCancel); }

            // ★ 过账不需要选行；冲销需要选一行
            if (oTable) {
                oTable.setSelectionMode(bIsCancel ? "MultiToggle" : "None");
                if (!bIsCancel) { oTable.clearSelection(); }
            }
        },

        //========================================================
        // ★ 过账JOB：不选行，把检索条件传给后端排JOB
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

            var oPayload = this._buildPostPayload();
            if (!oPayload) {
                MessageBox.error(oBundle.getText("filterIncompleteMsg"));
                return;
            }

            MessageBox.confirm(
                oBundle.getText("postJobConfirmMsg"),
                {
                    title: oBundle.getText("postJobConfirmTitle"),
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
        // ★ 冲销JOB：必须选且只能选一行，传该行的创建日期
        //   后端会先同步校验（「请先冲销过账期间 XXX 的数据」），
        //   通过后才排JOB
        //========================================================
        onCancelJob: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();
            var oTable  = this.byId("Table_ProxyJournal");

            if (this._bRunning) { return; }

            var aIndices = oTable ? oTable.getSelectedIndices() : [];

            if (aIndices.length === 0) {
                MessageBox.warning(oBundle.getText("selectAtLeastOneRow"));
                return;
            }
            if (aIndices.length > 1) {
                MessageBox.warning(oBundle.getText("cancelSelectOnlyOne"));
                return;
            }

            if (!this._checkCompanyAuthority()) { return; }

            var oContext = oTable.getContextByIndex(aIndices[0]);
            var oRow     = oContext && this.getModel().getObject(oContext.getPath());
            if (!oRow) {
                MessageBox.error(oBundle.getText("selectAtLeastOneRow"));
                return;
            }

            var sCreationDate = this._toAbapDate(oRow.CreationDate);
            if (!sCreationDate) {
                MessageBox.error(oBundle.getText("cancelNoCreationDate"));
                return;
            }

            var oPayload = { CreationDate: sCreationDate };
            var sShowDate = formatter.date(oRow.CreationDate) || sCreationDate;

            MessageBox.confirm(
                oBundle.getText("cancelJobConfirmMsg", [sShowDate]),
                {
                    title: oBundle.getText("cancelJobConfirmTitle"),
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

        //========================================================
        // ★ 调后端排JOB
        //   JOB是异步的，排完后 ZTFI_1029 还没结果，所以【不刷新列表】
        //   用户稍后重新点 GO 就能看到（查询类会回填上次执行的 E 消息）
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

        // 表格是否有数据（未查询 / 查询结果0条 → false）
        _hasTableData: function () {
            var oTable   = this.byId("Table_ProxyJournal");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oBinding) { return false; }
            return oBinding.getLength() > 0;
        },

        //========================================================
        // ★ 过账JOB的payload：从 SmartFilterBar 读检索条件
        //   {
        //     "SourceCompanyCode": "2200",
        //     "TargetCompanyCode": "2000",
        //     "FiscalYear":   [{"sign":"I","option":"EQ","low":"2026","high":""}],
        //     "FiscalPeriod": [{"sign":"I","option":"EQ","low":"004","high":""}]
        //   }
        //   条件不完整返回 null
        //========================================================
        _buildPostPayload: function () {
            var oSFB = this.byId("SFBProxyJournal");
            if (!oSFB) { return null; }

            var oFilterData = oSFB.getFilterData() || {};

            var sSource = oFilterData.SourceCompanyCode;
            var sTarget = oFilterData.TargetCompanyCode;

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

            if (!sSource || !sTarget || !sGjahr || !sMonat) {
                return null;
            }

            return {
                SourceCompanyCode: sSource,
                TargetCompanyCode: sTarget,
                FiscalYear:   [{ sign: "I", option: "EQ", low: sGjahr, high: "" }],
                FiscalPeriod: [{ sign: "I", option: "EQ", low: sMonat, high: "" }]
            };
        },

        // Edm.DateTime / Date / YYYYMMDD → ABAP 的 YYYYMMDD
        _toAbapDate: function (vValue) {
            if (!vValue) { return ""; }

            if (vValue instanceof Date) {
                var y = String(vValue.getFullYear());
                var m = ("0" + (vValue.getMonth() + 1)).slice(-2);
                var d = ("0" + vValue.getDate()).slice(-2);
                return y + m + d;
            }

            var s = String(vValue);
            // 已经是 YYYYMMDD
            if (/^\d{8}$/.test(s)) { return s; }
            // YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) { return s.substring(0, 10).replace(/-/g, ""); }

            var oDate = new Date(s);
            if (!isNaN(oDate.getTime())) {
                return this._toAbapDate(oDate);
            }
            return "";
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

        //========================================================
        // ★ 以下为旧版「前台同步过账/冲销 + 逐行回写」的逻辑，
        //   现已改为「排JOB + 重新GO时由查询类回填」，故整段保留但不再调用。
        //========================================================
        /*
        _selectAllRows: function () {
            var oTable   = this.byId("Table_ProxyJournal");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oTable || !oBinding) { return; }
            var iLength = oBinding.getLength();
            oTable.clearSelection();
            if (iLength > 0) { oTable.addSelectionInterval(0, iLength - 1); }
        },

        _hasPostedAccountingDocument: function () {
            var oTable   = this.byId("Table_ProxyJournal");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oBinding) { return false; }
            var iLength = oBinding.getLength();
            for (var i = 0; i < iLength; i++) {
                var oContext = oBinding.getContextByIndex(i);
                var oRow     = oContext && oContext.getObject();
                if (oRow && oRow.PostedAccountingDocument) { return true; }
            }
            return false;
        },

        _hasReversedAccountingDocument: function () {
            var oTable   = this.byId("Table_ProxyJournal");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oBinding) { return false; }
            var iLength = oBinding.getLength();
            for (var i = 0; i < iLength; i++) {
                var oContext = oBinding.getContextByIndex(i);
                var oRow     = oContext && oContext.getObject();
                if (oRow && oRow.Status === "S") { return true; }
            }
            return false;
        },

        preparePostBody: function () {
            var oTable   = this.byId("Table_ProxyJournal");
            var aIndices = oTable.getSelectedIndices();
            var selectedRows = [];
            aIndices.forEach((iIndex) => {
                var sPath = oTable.getContextByIndex(iIndex).getPath();
                var oRow  = Object.assign({}, this.getModel().getObject(sPath));
                delete oRow.__metadata;
                selectedRows.push(oRow);
            });
            return [JSON.stringify(selectedRows)];
        },

        _setIfExists: function (sKey, sProperty, vValue) {
            if (vValue !== undefined && vValue !== null) {
                this._oDataModel.setProperty(sKey + "/" + sProperty, vValue);
            }
        },

        _buildEntityKey: function (line) {
            var sSourceCompanyCode  = line.SOURCECOMPANYCODE || line.SourceCompanyCode;
            var sTargetCompanyCode  = line.TARGETCOMPANYCODE || line.TargetCompanyCode;
            var sFiscalYear         = line.FISCALYEAR        || line.FiscalYear;
            var sFiscalPeriod       = line.FISCALPERIOD      || line.FiscalPeriod;
            var sPostingStatus      = line.POSTINGSTATUS     || line.PostingStatus;
            var sAccountingDocument = line.ACCOUNTINGDOCUMENT || line.AccountingDocument;
            var sLedgerGLLineItem   = line.LEDGERGLLINEITEM  || line.LedgerGLLineItem;

            if (!sSourceCompanyCode || !sTargetCompanyCode || !sFiscalYear ||
                !sFiscalPeriod || !sAccountingDocument || !sLedgerGLLineItem) {
                return "";
            }

            return "/" + ENTITY_SET +
                "(SourceCompanyCode='"  + sSourceCompanyCode  +
                "',TargetCompanyCode='" + sTargetCompanyCode  +
                "',FiscalYear='"        + sFiscalYear         +
                "',FiscalPeriod='"      + sFiscalPeriod       +
                "',PostingStatus='"     + sPostingStatus      +
                "',AccountingDocument='"+ sAccountingDocument +
                "',LedgerGLLineItem='"  + sLedgerGLLineItem   +
                "')";
        }
        */

    });
});