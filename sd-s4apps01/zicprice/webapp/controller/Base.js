sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
    "use strict";

    /**
     * 页签共用基类：
     *   · processLogic action 调用封装（Event + Zzkey）
     *   · 工厂权限校验（读 component 的 auth 模型 /data/PlantSet）
     */
    return Controller.extend("sd.zicprice.controller.Base", {

        /**
         * 调用 processLogic action
         * @param {string} sZzkey  JSON 字符串（filter + 选中整行）
         * @param {string} sEvent  REFRESH_PUR / REFRESH_SLS / UPDATE
         * @returns {Promise}
         */
        postAction: function (sZzkey, sEvent) {
            var oModel = this.getView().getModel();
            return new Promise(function (resolve, reject) {
                oModel.callFunction("/processLogic", {
                    method: "POST",
                    urlParameters: { Event: sEvent, Zzkey: sZzkey },
                    success: function (oData) { resolve(oData); },
                    error: function (oError) { reject(oError); }
                });
            });
        },

        /** 统一错误文本提取 */
        extractError: function (oError) {
            var sMsg;
            try {
                sMsg = JSON.parse(oError.responseText).error.message.value;
            } catch (e) {
                sMsg = oError.message || oError.responseText || String(oError);
            }
            return sMsg;
        },

        //========================================================
        //  工厂权限校验（页签1/2 用）
        //========================================================
        /**
         * 校验一组工厂是否都在用户被授权工厂内。
         *   权限数据还没取回（PlantSet 为空）时不拦截。
         * @param {string[]} aPlants 待校验工厂
         * @returns {boolean} true=通过；false=已弹错，调用方应中止
         */
        checkPlantAuthority: function (aPlants) {
            var oAuth = this.getOwnerComponent().getModel("auth").getData() || {};
            var aSet = oAuth.data && oAuth.data.PlantSet;
            if (!aSet) { return true; }   // 权限未就绪，先不拦

            var aAuth = aSet.map(function (d) { return d.Plant; });
            var aBad = (aPlants || []).filter(function (p) {
                return p && aAuth.indexOf(p) === -1;
            });

            if (aBad.length) {
                var oBundle = this.getView().getModel("i18n").getResourceBundle();
                MessageBox.error(oBundle.getText("noAuthorityPlant", [aBad.join(", ")]));
                return false;
            }
            return true;
        },

        /** SmartFilterBar 单个字段值 → key 数组（兼容 string / {items,ranges}） */
        extractFieldKeys: function (oField) {
            var aOut = [];
            if (!oField) { return aOut; }
            if (typeof oField === "string") {
                if (oField) { aOut.push(oField); }
                return aOut;
            }
            (oField.items || []).forEach(function (it) {
                if (it.key) { aOut.push(it.key); }
            });
            (oField.ranges || []).forEach(function (r) {
                if (r.value1 != null) { aOut.push(String(r.value1)); }
            });
            return aOut;
        }
    });
});