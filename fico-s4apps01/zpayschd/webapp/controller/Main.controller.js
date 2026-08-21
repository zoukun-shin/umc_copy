sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
    "sap/m/MessageBox",
    "sap/m/Button"
], (Controller, messages, Filter, formatter, MessageBox, Button) => {
    "use strict";

    return Controller.extend("fico.zpayschd.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._sEmail = "";
            this._iLastFilterErr = 0;
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._LocalData.setData({ editMode: false });
            this.getOwnerComponent().getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        getModel: function (sName) {
            return this.getOwnerComponent().getModel(sName);
        },

        onAfterRendering: function () {
            // 标准导出按钮是 SmartTable 运行时生成的,挂在表的渲染事件上反复尝试,
            // 直到工具栏内容生成后抓到为止(汇总页签懒加载也能覆盖)
            ["idDtlTable", "idSumTable"].forEach(function (sTableId) {
                var oTable = this.byId(sTableId);
                if (oTable && !oTable.data("exportDelegateDone")) {
                    oTable.data("exportDelegateDone", true);
                    oTable.addEventDelegate({
                        onAfterRendering: this._setupExportButton.bind(this, sTableId)
                    });
                    this._setupExportButton(sTableId);
                }
            }.bind(this));
        },

        // SmartTable 标准导出按钮是 OverflowToolbarMenuButton,工具栏里只显示图标:
        // 隐藏它,在原位置插一个带文字的按钮(zpayschd-Export 权限),点击转发给标准导出动作
        _setupExportButton: function (sTableId) {
            var oTable = this.byId(sTableId);
            if (!oTable || oTable.data("exportCfgDone")) { return; }

            var oToolbar = (oTable.getCustomToolbar && oTable.getCustomToolbar()) || oTable._oToolbar;
            if (!oToolbar || !oToolbar.getContent) { return; }

            // 按 Excel 图标/内部 ID 特征找标准导出按钮,不依赖固定 ID
            var oBtn = null;
            oToolbar.getContent().some(function (oCtrl) {
                var sIcon = oCtrl.getIcon && oCtrl.getIcon();
                if (sIcon === "sap-icon://excel-attachment" ||
                    oCtrl.getId().indexOf("btnExcelExport") > -1) {
                    oBtn = oCtrl;
                    return true;
                }
            });
            if (!oBtn) { return; }

            oTable.data("exportCfgDone", true);
            oBtn.setVisible(false);
            var oDownloadBtn = new Button({
                text: "{i18n>btnDownload}",
                icon: "sap-icon://excel-attachment",
                enabled: "{local>/authorityCheck/button/Export}",
                press: this._triggerStandardExport.bind(this, oBtn)
            });
            oToolbar.insertContent(oDownloadBtn, oToolbar.indexOfContent(oBtn));
        },

        _triggerStandardExport: function (oBtn) {
            var oMenu = oBtn.getMenu && oBtn.getMenu();
            var oItem = oMenu && oMenu.getItems().length ? oMenu.getItems()[0] : null;
            if (oItem && oItem.firePress) {
                oItem.firePress();
            } else if (oMenu && oMenu.fireItemSelected && oItem) {
                oMenu.fireItemSelected({ item: oItem });
            } else if (oBtn.firePress) {
                oBtn.firePress();
            }
        },

        _initialize: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            this._sEmail = sEmail;
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zpayschd-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zpayschd-View"),
                        Save: aAllAccessBtns.some(btn => btn.AccessId === "zpayschd-Save"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zpayschd-Export")
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

        // 公司代码权限校验
        //   返回 false = 校验不通过（已弹错误框）
        _checkCompanyAuthority: function () {
            var oSFB = this.byId("idFilterBar");
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

        // 工厂权限校验（同公司代码模式）
        _checkPlantAuthority: function () {
            var oSFB = this.byId("idFilterBar");
            if (!oSFB) { return true; }

            var oFilterData = oSFB.getFilterData() || {};
            var oBundle     = this.getModel("i18n").getResourceBundle();

            var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet) {
                return true;
            }

            var sPlant = oFilterData.Plant;
            if (sPlant && !aAuthorityPlantSet.some(function (d) { return d.Plant === sPlant; })) {
                MessageBox.error(oBundle.getText("noAuthorityPlant", [sPlant]));
                return false;
            }

            return true;
        },

        //========================================================
        // 检索(两个页签共用一个 SmartFilterBar)
        //========================================================
        onBeforeRebindDtl: function (oEvent) {
            this._applyCommonFilters(oEvent);
        },

        onBeforeRebindSum: function (oEvent) {
            // 重新查询丢弃未保存的编辑
            if (this._LocalData.getProperty("/editMode")) {
                this._oDataModel.resetChanges();
                this._LocalData.setProperty("/editMode", false);
            }
            this._applyCommonFilters(oEvent);
        },

        /**
         * 共通检索处理:必输校验 / 权限校验 / 期间区间转换 / 理论付款日区间
         * 校验不过时 preventTableBind 阻止请求
         */
        _applyCommonFilters: function (oEvent) {
            var mParams = oEvent.getParameter("bindingParams");
            var oSfb = this.byId("idFilterBar");
            var oFilterData = oSfb.getFilterData();
            var aNewFilter = [];

            // 必输:公司代码
            if (!oFilterData.CompanyCode) {
                this._filterError("msgMandatory");
                mParams.preventTableBind = true;
                return;
            }

            // 必输:会计年度期间(区间,YYYYMM -> YYYY0MM)
            var oDRPeriod = this.byId("idDRFiscalPeriod");
            var oFrom = oDRPeriod.getDateValue();
            var oTo = oDRPeriod.getSecondDateValue() || oFrom;
            if (!oFrom) {
                this._filterError("msgMandatory");
                mParams.preventTableBind = true;
                return;
            }

            // 公司代码 + 工厂权限校验
            if (!this._checkCompanyAuthority() || !this._checkPlantAuthority()) {
                mParams.preventTableBind = true;
                return;
            }

            var fnPeriod = function (oDate) {
                var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
                return oDate.getFullYear() + "0" + sMonth;
            };
            aNewFilter.push(new Filter("FiscalYearPeriod", "BT", fnPeriod(oFrom), fnPeriod(oTo)));

            // 理论付款日区间(计算字段,后端结果侧过滤)
            var oDRNetDue = this.byId("idDRNetDueDate");
            var oDueFrom = oDRNetDue.getDateValue();
            var oDueTo = oDRNetDue.getSecondDateValue() || oDueFrom;
            if (oDueFrom) {
                aNewFilter.push(new Filter("NetDueDate", "BT",
                    formatter.odataDate(oDueFrom), formatter.odataDate(oDueTo)));
            }

            if (aNewFilter.length > 0) {
                mParams.filters.push(new Filter({ filters: aNewFilter, and: true }));
            }
        },

        /** 检索错误提示(两个表同时 rebind 时防重复弹框) */
        _filterError: function (sKey, aArgs) {
            var iNow = Date.now();
            if (iNow - this._iLastFilterErr > 500) {
                this._iLastFilterErr = iNow;
                messages.showError(this._text(sKey, aArgs));
            }
        },

        //========================================================
        // 汇总页签:编辑 / 保存 / 取消(调整付款日 -> ZTFI_1042)
        //========================================================
        onEdit: function () {
            this._LocalData.setProperty("/editMode", true);
        },

        onCancelEdit: function () {
            this._oDataModel.resetChanges();
            this._LocalData.setProperty("/editMode", false);
        },

        /** 调整付款日不允许清空/非法日期,当场恢复原值 */
        onAdjustDateChange: function (oEvent) {
            var oDP = oEvent.getSource();
            if (!oDP.getDateValue() || oEvent.getParameter("valid") === false) {
                messages.showError(this._text("msgAdjustDateEmpty"));
                var oContext = oDP.getBindingContext();
                if (oContext) {
                    this._oDataModel.resetChanges([oContext.getPath() + "/AdjustPaymentDate"]);
                }
            }
        },

        onSave: function () {
            // 公司代码权限校验（防止查询后改了公司代码再点）
            if (!this._checkCompanyAuthority()) { return; }

            var oModel = this._oDataModel;
            var mPending = oModel.getPendingChanges();
            var aItems = [];
            var bEmpty = false;

            Object.keys(mPending).forEach(function (sKey) {
                if (sKey.indexOf("PaySchdSum") !== 0) { return; }
                var oRow = oModel.getProperty("/" + sKey);
                if (!oRow) { return; }
                if (!oRow.AdjustPaymentDate) {
                    bEmpty = true;
                    return;
                }
                aItems.push({
                    Companycode: oRow.CompanyCode,
                    Supplier: oRow.Supplier,
                    Paymentterms: oRow.Paymentterms,
                    Netduedate: this._fmtDate(oRow.NetDueDate),
                    Currency: oRow.TransactionCurrency,
                    Adjustpaymentdate: this._fmtDate(oRow.AdjustPaymentDate)
                });
            }.bind(this));

            if (bEmpty) {
                messages.showError(this._text("msgAdjustDateEmpty"));
                return;
            }
            if (aItems.length === 0) {
                messages.showText(this._text("msgNoChanges"));
                return;
            }

            var sZzkey = JSON.stringify({
                Useremail: this._sEmail,
                Items: aItems
            });
            this.getView().setBusy(true);
            oModel.callFunction("/processLogic", {
                method: "POST",
                urlParameters: { Event: "SAVE", Zzkey: sZzkey },
                success: function (oData) {
                    this.getView().setBusy(false);
                    this._handleSaveResult(oData);
                }.bind(this),
                error: function (oError) {
                    this.getView().setBusy(false);
                    messages.showError(messages.parseErrors(oError));
                }.bind(this)
            });
        },

        _handleSaveResult: function (oData) {
            var oRet = (oData && oData.processLogic) || oData || {};
            var oResp = {};
            try {
                oResp = JSON.parse(oRet.Zzkey || oRet.zzkey || "{}");
            } catch (e) { /* 保底走未知错误 */ }
            var fnGet = function (sName) {
                return oResp[sName] !== undefined ? oResp[sName] : oResp[sName.toUpperCase()];
            };

            if (fnGet("msgtyp") === "S") {
                messages.showText(this._text("msgSaveSuccess", [fnGet("savedcount")]));
                this._oDataModel.resetChanges();
                this._LocalData.setProperty("/editMode", false);
                this.byId("idSumTable").rebindTable();
            } else {
                // 后端返回简单 code,文案由前端 i18n 映射
                var mCode = {
                    "NO_DATA": "msgNoData",
                    "DATE_EMPTY": "msgAdjustDateEmpty",
                    "LOCKED": "msgLocked",
                    "LOCK_FAILURE": "msgSaveFailed",
                    "SAVE_FAILED": "msgSaveFailed"
                };
                messages.showError(this._text(mCode[fnGet("msg")] || "msgSaveFailed"));
            }
        },

        /** JS Date(UTC 零点)-> "yyyy-MM-dd"(/ui2/cl_json 可直接转 DATS) */
        _fmtDate: function (oDate) {
            if (!oDate) { return null; }
            return oDate.toISOString().slice(0, 10);
        },

        _text: function (sKey, aArgs) {
            return this.getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        }
    });
});