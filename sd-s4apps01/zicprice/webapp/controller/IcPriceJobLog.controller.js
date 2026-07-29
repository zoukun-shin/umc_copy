sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, MessageBox) {
    "use strict";

    /**
     * 页签3：修改日志（只读）
     *   执行对象(UpdateType) 用 MultiComboBox 下拉（11/12/21/22），
     *   必输由前端校验，过滤在 onBeforeRebindTable 注入。
     */
    return Base.extend("sd.zicprice.controller.IcPriceJobLog", {

        formatter: formatter,

        onInit: function () {
            // 本页签用 job service（ZUI_ICPRICEJOBLOG_O2）作默认 model
            this.getView().setModel(this.getOwnerComponent().getModel("job"));
        },

        onSearch: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oMcb = this.byId("idMCBUpdType");
            if (!oMcb || !oMcb.getSelectedKeys().length) {
                MessageBox.error(oBundle.getText("msgUpdTypeRequired"));
                return;
            }
            this.byId("idLogSmartTable").rebindTable();
        },

        // 自定义控件的过滤手工加进 filter：执行对象 + 执行日期区间
        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameter("bindingParams").filters;

            // 执行对象（多选下拉）→ OR
            var oMcb = this.byId("idMCBUpdType");
            var aKeys = oMcb ? oMcb.getSelectedKeys() : [];
            if (aKeys.length) {
                aFilters.push(new Filter({
                    filters: aKeys.map(function (k) { return new Filter("UpdateType", "EQ", k); }),
                    and: false
                }));
            }

            // 执行状态（下拉多选）→ OR
            var oSt = this.byId("idMCBExecStatus");
            var aSt = oSt ? oSt.getSelectedKeys() : [];
            if (aSt.length) {
                aFilters.push(new Filter({
                    filters: aSt.map(function (k) { return new Filter("ExecStatus", "EQ", k); }),
                    and: false
                }));
            }

            // 执行日期区间
            var oDR = this.byId("idDRLog");
            if (oDR && oDR.getDateValue()) {
                aFilters.push(new Filter("CreatedOn", "BT",
                    this._fmt(oDR.getDateValue()), this._fmt(oDR.getSecondDateValue())));
            }
        },

        _fmt: function (oDate) {
            if (!oDate) { return null; }
            var y = oDate.getFullYear();
            var m = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var d = ("0" + oDate.getDate()).slice(-2);
            return "" + y + m + d;
        },

        // 执行对象：11/12/21/22 → 带描述（i18n>updType11 ...，文本已含代码）
        formatUpdateType: function (sCode) {
            if (!sCode) { return ""; }
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            return oBundle.getText("updType" + sCode) || sCode;
        },

        // 去前导零（对象号/对象行号显示用）
        stripZeros: function (sVal) {
            if (sVal === undefined || sVal === null || sVal === "") { return sVal; }
            var s = String(sVal).replace(/^0+/, "");
            return s === "" ? "0" : s;
        }
    });
});