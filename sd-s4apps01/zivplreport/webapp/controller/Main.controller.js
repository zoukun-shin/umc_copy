sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, MessageBox) {
    "use strict";

    return Base.extend("sd.zivplreport.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail(); 
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignSalesOrg,_AssignRole($expand=_UserRoleAccessBtn)"
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zivplreport-View")) {
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

                //  存销售组织权限数据，供 onBeforeRebindTable 的 _checkSalesOrgAuthority 使用
                this.getModel("local").setProperty("/authorityCheck", {
                    data: {
                        SalesOrgSet: context._AssignSalesOrg
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

        onSearch: function () {
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            if (this._oDataModel.hasPendingChanges()) {
                this._oDataModel.resetChanges();
            }

            //  销售组织权限校验（不通过则不绑定表格）
            if (!this._checkSalesOrgAuthority()) {
                mBindingParams.preventTableBind = true;
                return;
            }

            // 自定义筛选条件：发票日期区间（DateRangeSelection）
            var oBillingDate = this.byId("idBillingDate");
            this._removeFilterByPath(mBindingParams.filters, "BillingDocumentDateFilter");
            if (oBillingDate.getDateValue()) {
                mBindingParams.filters.push(new Filter({
                    path: "BillingDocumentDateFilter",
                    operator: FilterOperator.BT,
                    value1: oBillingDate.getDateValue(),
                    value2: oBillingDate.getSecondDateValue() || oBillingDate.getDateValue()
                }));
            }

            // 自定义筛选条件：DN日期区间（DateRangeSelection）
            var oDeliveryDate = this.byId("idDeliveryDate");
            this._removeFilterByPath(mBindingParams.filters, "DeliveryDate");
            if (oDeliveryDate.getDateValue()) {
                mBindingParams.filters.push(new Filter({
                    path: "DeliveryDate",
                    operator: FilterOperator.BT,
                    value1: oDeliveryDate.getDateValue(),
                    value2: oDeliveryDate.getSecondDateValue() || oDeliveryDate.getDateValue()
                }));
            }
        },

        //========================================================
        //  销售组织权限校验（多选）
        //   返回 false = 校验不通过（已弹错误框）
        //========================================================
        _checkSalesOrgAuthority: function () {
            var oSFB = this.byId("SFBIvplReport");
            if (!oSFB) { return true; }

            var oBundle = this.getModel("i18n").getResourceBundle();

            var aAuthoritySalesOrgSet = this.getModel("local").getProperty("/authorityCheck/data/SalesOrgSet");
            if (!aAuthoritySalesOrgSet) {
                // 权限数据还没取回来，先不拦（_initialize 里取失败会另行弹窗）
                return true;
            }

            // 收集用户在 SalesOrganization 筛选里选中的所有值
            var aSelected = this._getSelectedSalesOrgs();
            if (aSelected.length === 0) {
                // 没选销售组织：默认不拦。若要「不选=只看有权限的」，另行处理
                return true;
            }

            // 找出没有权限的销售组织
            var aUnauthorized = aSelected.filter(function (sVkorg) {
                return !aAuthoritySalesOrgSet.some(function (d) {
                    return d.SalesOrganization === sVkorg;   // 字段名已确认为 SalesOrganization（与 zdelivtransfee 参考一致）
                });
            });

            if (aUnauthorized.length > 0) {
                MessageBox.error(oBundle.getText("noAuthoritySalesOrg", [aUnauthorized.join(", ")]));
                return false;
            }

            return true;
        },

        //========================================================
        // 从 SmartFilterBar 读出 SalesOrganization 多选里选中的所有值
        //   多选字段 getFilterData 返回 { items:[{key}], ranges:[{operation,low,high}], value }
        //========================================================
        _getSelectedSalesOrgs: function () {
            var oSFB = this.byId("SFBIvplReport");
            var oFilterData = (oSFB && oSFB.getFilterData()) || {};
            var vSalesOrg = oFilterData.SalesOrganization;
            var aResult = [];

            if (!vSalesOrg) { return aResult; }

            // 兼容单值字符串
            if (typeof vSalesOrg === "string") {
                if (vSalesOrg) { aResult.push(vSalesOrg); }
                return aResult;
            }

            // 多选对象
            (vSalesOrg.items || []).forEach(function (o) {
                if (o && o.key) { aResult.push(o.key); }
            });
            (vSalesOrg.ranges || []).forEach(function (o) {
                if (o && o.low && (o.operation === "EQ" || o.operation === "Contains")) {
                    aResult.push(o.low);
                }
            });
            if (vSalesOrg.value) { aResult.push(vSalesOrg.value); }

            // 去重
            return aResult.filter(function (v, i, a) { return a.indexOf(v) === i; });
        },

        _removeFilterByPath: function (aFilters, sPath) {
            for (var i = aFilters.length - 1; i >= 0; i--) {
                if (aFilters[i].sPath === sPath) {
                    aFilters.splice(i, 1);
                }
            }
        }
    });
});