sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
    "sap/m/MessageBox",
    "sap/m/Button"
], (Controller, messages, Filter, formatter, MessageBox, Button) => {
    "use strict";

    return Controller.extend("fico.zporecon.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._iLastFilterErr = 0;
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._LocalData.setData({});
            this.getOwnerComponent().getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        getModel: function (sName) {
            return this.getOwnerComponent().getModel(sName);
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zporecon-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zporecon-View"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zporecon-Export")
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
        // 隐藏它,在原位置插一个带文字的按钮(zporecon-Export 权限),点击转发给标准导出动作
        _setupExportButton: function (sTableId) {
            var oTable = this.byId(sTableId);
            if (!oTable || oTable.data("exportCfgDone")) { return; }

            var oToolbar = (oTable.getCustomToolbar && oTable.getCustomToolbar()) || oTable._oToolbar;
            if (!oToolbar || !oToolbar.getContent) { return; }

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

        //========================================================
        // 检索(两个页签共用一个 SmartFilterBar)
        //========================================================
        onBeforeRebindDtl: function (oEvent) {
            this._applyCommonFilters(oEvent);
        },

        onBeforeRebindSum: function (oEvent) {
            this._applyCommonFilters(oEvent);
        },

        /**
         * 共通检索处理:必输校验 / 权限校验 / PO发行日期区间
         * 校验不过时 preventTableBind 阻止请求
         */
        _applyCommonFilters: function (oEvent) {
            var mParams = oEvent.getParameter("bindingParams");
            var oSfb = this.byId("idFilterBar");
            var oFilterData = oSfb.getFilterData();

            // 必输:公司代码
            if (!oFilterData.CompanyCode) {
                this._filterError("msgMandatory");
                mParams.preventTableBind = true;
                return;
            }

            // 必输:PO发行日期(区间)
            var oDRPoDate = this.byId("idDRPoDate");
            var oFrom = oDRPoDate.getDateValue();
            var oTo = oDRPoDate.getSecondDateValue() || oFrom;
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

            mParams.filters.push(new Filter("PurchaseOrderDate", "BT",
                formatter.odataDate(oFrom), formatter.odataDate(oTo)));
        },

        /** 检索错误提示(两个表同时 rebind 时防重复弹框) */
        _filterError: function (sKey, aArgs) {
            var iNow = Date.now();
            if (iNow - this._iLastFilterErr > 500) {
                this._iLastFilterErr = iNow;
                messages.showError(this._text(sKey, aArgs));
            }
        },

        _text: function (sKey, aArgs) {
            return this.getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        }
    });
});