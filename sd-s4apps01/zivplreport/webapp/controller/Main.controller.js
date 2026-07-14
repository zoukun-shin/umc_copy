sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Base, formatter, Filter, FilterOperator) {
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
                "$expand": "_AssignRole($expand=_UserRoleAccessBtn)"
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

        _removeFilterByPath: function (aFilters, sPath) {
            for (var i = aFilters.length - 1; i >= 0; i--) {
                if (aFilters[i].sPath === sPath) {
                    aFilters.splice(i, 1);
                }
            }
        }
    });
});