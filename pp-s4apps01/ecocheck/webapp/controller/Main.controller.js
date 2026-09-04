sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) => {
    "use strict";

    return Base.extend("pp.ecocheck.controller.Main", {
        formatter: formatter,

        onInit() {
            if (!this.getOwnerComponent()) {
                return;
            }
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
            this._UserInfo = (sap.ushell && sap.ushell.Container) ? sap.ushell.Container.getService("UserInfo") : null;
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        // SmartFilterBar 初始化完成后，给"有效起始日期"赋默认当天
        onSmartFilterBarInitialized() {
            var oDatePicker = this.byId("idEffectiveDate");
            if (oDatePicker && !oDatePicker.getDateValue()) {
                oDatePicker.setDateValue(new Date());
            }
        },

        // 权限校验：画面角色(ecocheck-View) + 工厂权限集（与参考程序 zalterandmainmater 相同，仅改 AccessId）
        _initialize() {
            if (!this._UserInfo) {
                return;
            }
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getOwnerComponent().getModel("Authority").bindContext(
                "/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                    "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
                }
            );
            oContextBinding.requestObject().then(function (context) {
                var aAccessBtns = [],
                    aAllAccessBtns = [];
                if (context._AssignRole && context._AssignRole.length > 0) {
                    context._AssignRole.forEach(role => {
                        aAccessBtns.push(role._UserRoleAccessBtn);
                    });
                    aAllAccessBtns = aAccessBtns.flat();
                }
                if (!aAllAccessBtns.some(btn => btn.AccessId === "ecocheck-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "ecocheck-View")
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });
            }.bind(this), function () {
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

        // SmartTable 重绑前注入自定义筛选（工厂越权/显示所有BOM项目/有效起始日期/用户邮箱）
        onBeforeRebindTable(oEvent) {
            var mBinding = oEvent.getParameter("bindingParams");
            var oFilters = mBinding.filters;
            var oSmartFilterBar = this.byId("idSmartFilterBar");
            // 每次查询前重置"单条无BOM空行"提示标记
            this._bSentinelShown = false;

            // 1) 工厂越权拦截：仅当权限集已加载后校验（区分"已加载为空→拦截"与"尚未加载→放行"）
            var aPlantSet = this._LocalData.getProperty("/authorityCheck/data/PlantSet");
            if (aPlantSet && oSmartFilterBar && oSmartFilterBar.getFilterData) {
                var sPlant = oSmartFilterBar.getFilterData().Plant;
                if (sPlant && !aPlantSet.some(function (p) {
                    return p.Plant === sPlant;
                })) {
                    MessageBox.error(this._ResourceBundle.getText("noAuthorityPlant", [sPlant]));
                    // 阻止本次查询（参考 zproductdiscontinuation/zsemifinstockretention）
                    mBinding.preventTableBind = true;
                    return;
                }
            }

            // 2) 显示所有BOM项目：勾选才传 EQ true（不勾选=后端默认仅错误行）
            var oCBShowAllItems = this.byId("idCBShowAllItems");
            if (oCBShowAllItems && oCBShowAllItems.getSelected()) {
                oFilters.push(new Filter({
                    path: "ShowAllItems",
                    operator: FilterOperator.EQ,
                    value1: true
                }));
            }

            // 3) 有效起始日期：单日 EQ（后端只取 range 首值 low，不传则默认当天）
            var oEffectiveDate = this.byId("idEffectiveDate");
            var dEffective = oEffectiveDate && oEffectiveDate.getDateValue ? oEffectiveDate.getDateValue() : null;
            if (dEffective) {
                oFilters.push(new Filter({
                    path: "EffectiveDate",
                    operator: FilterOperator.EQ,
                    value1: formatter.odataDate(dEffective)
                }));
            }

            // 4) 用户邮箱：后端按邮箱→工厂权限取数（非 FLP 环境跳过）
            var sEmail = this._UserInfo && this._UserInfo.getEmail() !== undefined ? this._UserInfo.getEmail() : "";
            if (sEmail) {
                oFilters.push(new Filter({
                    path: "UserEmail",
                    operator: FilterOperator.EQ,
                    value1: sEmail
                }));
            }

            // 绑定数据到达回调：查询完成后检查"单条无BOM空行且Message有值"
            if (mBinding) {
                mBinding.events = {
                    dataReceived: this.onDataReceived.bind(this)
                };
            }
        },

        // 查询仅返回一条"数据检查无误"空行时，弹窗显示 Message 内容
        onDataReceived() {
            if (this._bSentinelShown) {
                return;
            }
            var oTable = this.byId("Table_BomCheck");
            if (!oTable) {
                return;
            }
            var oBinding = oTable.getBinding("rows");
            if (!oBinding || oBinding.getLength() !== 1) {
                return;
            }
            var aContexts = oBinding.getContexts(0, 1);
            var oRow = aContexts && aContexts[0] ? aContexts[0].getObject() : null;
            if (oRow && !oRow.BillOfMaterial && !oRow.MessageType && oRow.Message) {
                this._bSentinelShown = true;
                MessageBox.information(oRow.Message);
            }
        }
    });
});
