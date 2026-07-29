sap.ui.define([
    "sap/ui/model/type/Float"
], function (Float) {
    "use strict";

    // 专给【动态列单价】用：6位小数（DB字段 dec(23,6)，
    //   FS 4.3「条件值÷数量，最大保留6位」）
    //   固定列的金额(ConditionRateAmount, curr(23,2)) 不用这个，
    //   在 view 里内联 2位 Float
    return Float.extend("sd.zicprice.model.CustomDecimal", {
        constructor: function () {
            Float.apply(this, arguments);
            this.setFormatOptions({
                minFractionDigits: 0,
                maxFractionDigits: 6,
                groupingEnabled: true
            });
        }
    });
});
