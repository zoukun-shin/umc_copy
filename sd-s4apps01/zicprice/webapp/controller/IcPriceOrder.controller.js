sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/m/MessageBox",
    "sap/m/BusyDialog"
], function (Base, formatter, Filter, MessageBox, BusyDialog) {
    "use strict";

    return Base.extend("sd.zicprice.controller.IcPriceOrder", {

        formatter: formatter,

        onInit: function () {
            // 本页签用 order service（ZUI_ICPRICEORDER_O2）作默认 model
            this.getView().setModel(this.getOwnerComponent().getModel("order"));
            this._oBusy = new BusyDialog();
        },

        //================= GO：查订单价格 =================
        onSearch: function () {
            this.byId("idOrderSmartTable").rebindTable();
        },

        // 订单日期区间用自定义 DateRangeSelection，手工加进 filter
        onBeforeRebindTable: function (oEvent) {
            var mParams = oEvent.getParameter("bindingParams");
            var aFilters = mParams.filters;

            // 工厂权限校验（选了工厂才校验；不通过则不取数）
            var oData = this.byId("idOrderFilterBar").getFilterData();
            var aPlants = this.extractFieldKeys(oData.Plant);
            if (aPlants.length && !this.checkPlantAuthority(aPlants)) {
                mParams.preventTableBind = true;
                return;
            }

            var oDR = this.byId("idDROrder");
            if (oDR && oDR.getDateValue()) {
                aFilters.push(new Filter("OrderDateF", "BT",
                    this._fmt(oDR.getDateValue()), this._fmt(oDR.getSecondDateValue())));
            }
        },

        //================= 更新（改选中行 PO + IC-SO 价）=================
        onUpdate: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oSmart = this.byId("idOrderSmartTable");
            var oTable = oSmart.getTable();
            var aIdx = oTable.getSelectedIndices();

            if (!aIdx.length) {
                MessageBox.error(oBundle.getText("msgSelectRow"));
                return;
            }

            var aSelected = [];
            aIdx.forEach(function (i) {
                var oCtx = oTable.getContextByIndex(i);
                if (oCtx) { aSelected.push(this._cleanRow(oCtx.getObject())); }
            }.bind(this));

            if (!aSelected.length) {
                MessageBox.error(oBundle.getText("msgSelectRow"));
                return;
            }

            // 工厂权限校验：对选中行的工厂
            var aPlants = aSelected.map(function (r) { return r.Plant; })
                .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
            if (!this.checkPlantAuthority(aPlants)) {
                return;
            }

            var oSFB = this.byId("idOrderFilterBar");
            var oData = oSFB.getFilterData();
            var oPayload = {
                SalesOrganization: oData.SalesOrganization || "",
                Selected: aSelected
            };

            MessageBox.confirm(oBundle.getText("msgUpdateConfirm"), {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.YES) { return; }
                    this._oBusy.open();
                    this.postAction(JSON.stringify(oPayload), "UPDATE").then(function (oData2) {
                        var oRes = oData2 && oData2.processLogic;
                        var sZzkey = oRes && oRes.Zzkey ? oRes.Zzkey : "";
                        if (oRes && oRes.Event === "MESSAGE") {
                            MessageBox.error(sZzkey);
                        } else {
                            MessageBox.information(sZzkey, {
                                onClose: function () { this.onSearch(); }.bind(this)  // 更新完重查刷新状态
                            });
                        }
                    }.bind(this)).catch(function (oError) {
                        MessageBox.error(this.extractError(oError));
                    }.bind(this)).finally(function () {
                        this._oBusy.close();
                    }.bind(this));
                }.bind(this)
            });
        },

        // OData 行 → 干净对象（去 __metadata，/Date()/ 转 yyyymmdd）
        _cleanRow: function (oRow) {
            var oOut = {};
            Object.keys(oRow).forEach(function (k) {
                if (k === "__metadata") { return; }
                var v = oRow[k];
                if (typeof v === "string") {
                    var m = v.match(/\/Date\((-?\d+)\)\//);
                    if (m) {
                        var dt = new Date(parseInt(m[1], 10));
                        v = "" + dt.getUTCFullYear()
                            + ("0" + (dt.getUTCMonth() + 1)).slice(-2)
                            + ("0" + dt.getUTCDate()).slice(-2);
                    }
                }
                oOut[k] = v;
            });
            return oOut;
        },

        _fmt: function (oDate) {
            if (!oDate) { return null; }
            var y = oDate.getFullYear();
            var m = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var d = ("0" + oDate.getDate()).slice(-2);
            return "" + y + m + d;
        }
    });
});