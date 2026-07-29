sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
    "use strict";

    const ENTITY_SET = "GrirCogsTrf";

    return Base.extend("fico.zgrircogstrf.controller.Main", {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zgrircogstrf-View")) {
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
                        View:   aAllAccessBtns.some(btn => btn.AccessId === "zgrircogstrf-View"),
                        Post:   aAllAccessBtns.some(btn => btn.AccessId === "zgrircogstrf-Post"),
                        Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zgrircogstrf-Cancel")
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
            if (!this._checkCompanyAuthority()) {
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

            // 自定义筛选条件：Category
            var sCategory = this.byId("CategorySelect").getSelectedKey();
            this._removeFilterByPath(mBindingParams.filters, "Category");
            if (sCategory) {
                mBindingParams.filters.push(new Filter("Category", FilterOperator.EQ, sCategory));
            }

            this._setActionButtonsByPostingStatus();
        },

        // ★ 公司代码权限校验
        //   返回 false = 校验不通过（已弹错误框）
        _checkCompanyAuthority: function () {
            var oSFB = this.byId("SFBGrirCogsTrf");
            if (!oSFB) { return true; }

            var oFilterData = oSFB.getFilterData() || {};
            var oBundle     = this.getModel("i18n").getResourceBundle();

            var aAuthorityCompanySet = this.getModel("local").getProperty("/authorityCheck/data/CompanySet");
            if (!aAuthorityCompanySet) {
                // 权限数据还没取回来，先不拦（_initialize 里失败会另行弹窗）
                return true;
            }

            var sBukrs = oFilterData.CompanyCode;
            if (sBukrs && !aAuthorityCompanySet.some(function (d) { return d.CompanyCode === sBukrs; })) {
                MessageBox.error(oBundle.getText("noAuthorityCompanyCode", [sBukrs]));
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
            var oTable        = this.byId("Table_GrirCogsTrf");

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
            var oTable  = this.byId("Table_GrirCogsTrf");

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
        //   JOB是异步的，排完后 ZTFI_1032 还没结果，所以【不刷新列表】
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
            var oTable   = this.byId("Table_GrirCogsTrf");
            var oBinding = oTable && oTable.getBinding("rows");
            if (!oBinding) { return false; }
            return oBinding.getLength() > 0;
        },

        //========================================================
        // ★ 过账JOB的payload：从 SmartFilterBar / 自定义控件读检索条件
        //   {
        //     "CompanyCode":  "2200",
        //     "Category":     "1",
        //     "FiscalYear":   [{"sign":"I","option":"EQ","low":"2026","high":""}],
        //     "FiscalPeriod": [{"sign":"I","option":"EQ","low":"04","high":""}]
        //   }
        //   条件不完整返回 null
        //========================================================
        _buildPostPayload: function () {
            var oSFB = this.byId("SFBGrirCogsTrf");
            if (!oSFB) { return null; }

            var oFilterData = oSFB.getFilterData() || {};

            var sCompany = oFilterData.CompanyCode;

            // 年度/期间/业务类型是 customControl，不在 getFilterData 里
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

            var oCategCtl = this.byId("CategorySelect");
            var sCategory = oCategCtl ? oCategCtl.getSelectedKey() : "";

            if (!sCompany || !sGjahr || !sMonat || !sCategory) {
                return null;
            }

            return {
                CompanyCode: sCompany,
                Category:    sCategory,
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
        onPost: function () {
            var oTable   = this.byId("Table_GrirCogsTrf");
            var aIndices = oTable.getSelectedIndices();

            if (aIndices.length === 0) {
                this._selectAllRows();
            }
            if (this._hasPostedAccountingDocument()) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("NotPostRepeatedly"));
                return;
            }
            var oBundle = this.getModel("i18n").getResourceBundle();
            MessageBox.confirm(
                oBundle.getText("postConfirmMsg"),
                {
                    title: oBundle.getText("postConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._selectAllRows();
                            this._executeActionOld("POST");
                        }
                    }.bind(this)
                }
            );
        },

        onCancel: function () {
            var oTable   = this.byId("Table_GrirCogsTrf");
            var aIndices = oTable.getSelectedIndices();

            if (aIndices.length === 0) {
                MessageBox.warning(this.getModel("i18n").getResourceBundle().getText("selectAtLeastOneRow"));
                return;
            }
            if (aIndices.length > 1) {
                MessageBox.warning(this.getModel("i18n").getResourceBundle().getText("cancelSelectOnlyOne"));
                return;
            }
            if (this._hasReversedAccountingDocument()) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("NotReversedRepeatedly"));
                return;
            }
            var oContext      = oTable.getContextByIndex(aIndices[0]);
            var oRow          = this.getModel().getObject(oContext.getPath());
            var sCreationDate = formatter.date(oRow.CreationDate || oRow.CREATIONDATE) ||
                                String(oRow.CreationDate || oRow.CREATIONDATE || "");

            var oBundle = this.getModel("i18n").getResourceBundle();
            MessageBox.confirm(
                oBundle.getText("cancelConfirmMsg", [sCreationDate]),
                {
                    title: oBundle.getText("cancelConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._executeActionOld("CANCEL");
                        }
                    }.bind(this)
                }
            );
        },

        _selectAllRows: function () {
            var oTable   = this.byId("Table_GrirCogsTrf");
            var oBinding = oTable && oTable.getBinding("rows");

            if (!oTable || !oBinding) { return; }

            var iLength = oBinding.getLength();
            oTable.clearSelection();
            if (iLength > 0) {
                oTable.addSelectionInterval(0, iLength - 1);
            }
        },

        _hasPostedAccountingDocument: function () {
            var oTable   = this.byId("Table_GrirCogsTrf");
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
            var oTable   = this.byId("Table_GrirCogsTrf");
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

        _executeActionOld: function (sEvent) {
            var postDocs             = this.preparePostBody();
            var sCurrentPostingStatus = this.byId("PostingStatusSelect").getSelectedKey();
            this._BusyDialog.open();

            Promise.all([this.postAction(postDocs, sEvent)]).then((oData) => {
                oData.forEach((item) => {
                    var message = item["processLogic"].Event;
                    if (message && message === "MESSAGE") {
                        MessageBox.error(item["processLogic"].Zzkey);
                        return;
                    }
                    var aResult = JSON.parse(item["processLogic"].Zzkey);
                    aResult.forEach(function (line) {
                        line.POSTINGSTATUS = sCurrentPostingStatus;
                        var sKey = this._buildEntityKey(line);
                        if (!sKey) { return; }

                        this._setIfExists(sKey, "Status",  line.STATUS  || line.Status);
                        this._setIfExists(sKey, "Message", line.MESSAGE || line.Message);

                        this._setIfExists(sKey, "PostedCompanyCode",        line.POSTEDCOMPANYCODE        || line.PostedCompanyCode);
                        this._setIfExists(sKey, "PostedPostingDate",        line.POSTEDPOSTINGDATE        || line.PostedPostingDate);
                        this._setIfExists(sKey, "PostedFiscalYear",         line.POSTEDFISCALYEAR         || line.PostedFiscalYear);
                        this._setIfExists(sKey, "PostedAccountingDocument", line.POSTEDACCOUNTINGDOCUMENT || line.PostedAccountingDocument);

                        this._setIfExists(sKey, "ReversedCompanyCode",        line.REVERSEDCOMPANYCODE        || line.ReversedCompanyCode);
                        this._setIfExists(sKey, "ReversedPostingDate",        line.REVERSEDPOSTINGDATE        || line.ReversedPostingDate);
                        this._setIfExists(sKey, "ReversedFiscalYear",         line.REVERSEDFISCALYEAR         || line.ReversedFiscalYear);
                        this._setIfExists(sKey, "ReversedAccountingDocument", line.REVERSEDACCOUNTINGDOCUMENT || line.ReversedAccountingDocument);
                    }, this);
                });
            }).catch((error) => {
                MessageBox.error(error.message || error.responseText || String(error));
            }).finally(() => {
                this._BusyDialog.close();
            });
        },

        preparePostBody: function () {
            var oTable      = this.byId("Table_GrirCogsTrf");
            var aIndices    = oTable.getSelectedIndices();
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
            var sCompanyCode        = line.COMPANYCODE        || line.CompanyCode;
            var sFiscalYear         = line.FISCALYEAR         || line.FiscalYear;
            var sAccountingDocument = line.ACCOUNTINGDOCUMENT || line.AccountingDocument;
            var sLedgerGLLineItem   = line.LEDGERGLLINEITEM   || line.LedgerGLLineItem;

            if (!sCompanyCode || !sFiscalYear || !sAccountingDocument || !sLedgerGLLineItem) {
                return "";
            }

            return "/" + ENTITY_SET +
                "(CompanyCode='"        + sCompanyCode        +
                "',FiscalYear='"        + sFiscalYear         +
                "',AccountingDocument='"+ sAccountingDocument +
                "',LedgerGLLineItem='"  + sLedgerGLLineItem   +
                "')";
        }
        */

    });
});