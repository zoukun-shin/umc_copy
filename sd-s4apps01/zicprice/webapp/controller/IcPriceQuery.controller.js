sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/BusyDialog",
    "sap/ui/table/Column",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/ObjectStatus"
], function (Base, formatter, JSONModel, MessageBox, BusyDialog, UIColumn, Text, Label, ObjectStatus) {
    "use strict";

    // 透视用业务key（不含 DynPlant —— 工厂要摊成列）
    var KEY_FIELDS = ["SalesOrganization", "SoldToParty", "BillToParty", "Material", "ConditionRecord"];

    return Base.extend("sd.zicprice.controller.IcPriceQuery", {

        onInit: function () {
            // 本页签用 query service（ZUI_ICPRICEQUERY_O2）作默认 model
            this.getView().setModel(this.getOwnerComponent().getModel("query"));

            this._oLocal = new JSONModel({ rows: [] });
            this.getView().setModel(this._oLocal, "local");
            this._aDynCols = [];       // 已追加的动态列，显式记账便于删除
            this._aNarrow  = [];       // 原始窄表行（执行按钮按整行回传）
            this._oBusy = new BusyDialog();
        },

        //================= 查询 =================
        onSearch: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oSFB = this.byId("idSmartFilterBar");
            var oData = oSFB.getFilterData();

            if (!oData.SalesOrganization) {
                MessageBox.error(oBundle.getText("msgSalesOrgRequired"));
                return;
            }

            // 工厂权限校验（选了工厂才校验；未选=不限工厂）
            var aPlants = this.extractFieldKeys(oData.DynPlant);
            if (aPlants.length && !this.checkPlantAuthority(aPlants)) {
                return;
            }

            this._removeDynamicColumns();
            this._oLocal.setProperty("/rows", []);

            var aFilters = oSFB.getFilters();

            this._oBusy.open();
            this.byId("idDynamicPage").setBusy(true);

            this.getView().getModel().read("/IcPriceQuery", {
                filters: aFilters,
                success: function (oResult) {
                    var aNarrow = oResult.results || [];
                    this._aNarrow = aNarrow;                 // 留着给执行按钮回传整行
                    var aRows = this._transformData(aNarrow);
                    this._oLocal.setProperty("/rows", aRows);
                    this._addColumns();
                    this._oBusy.close();
                    this.byId("idDynamicPage").setBusy(false);
                }.bind(this),
                error: function (oError) {
                    this._oBusy.close();
                    this.byId("idDynamicPage").setBusy(false);
                    MessageBox.error(this.extractError(oError));
                }.bind(this)
            });
        },

        //================= 窄表 → 宽表（DynPlant 透视成列）=================
        _transformData: function (aData) {
            var oResult = {};
            aData.forEach(function (item) {
                var sKey = KEY_FIELDS.map(function (f) { return item[f]; }).join("_");

                if (!oResult[sKey]) {
                    oResult[sKey] = {
                        SalesOrganization: item.SalesOrganization,
                        DistributionChannel: item.DistributionChannel,
                        SoldToParty: item.SoldToParty,
                        BillToParty: item.BillToParty,
                        Material: item.Material,
                        MaterialName: item.MaterialName,
                        ConditionRecord: item.ConditionRecord,
                        ConditionTable: item.ConditionTable,
                        ConditionType: item.ConditionType,
                        ConditionRateAmount: item.ConditionRateAmount,
                        ConditionCurrency: item.ConditionCurrency,
                        ConditionQuantity: item.ConditionQuantity,
                        BaseUnit: item.BaseUnit,
                        ConditionValidityStartDate: item.ConditionValidityStartDate,
                        ConditionValidityEndDate: item.ConditionValidityEndDate,
                        _dyn: {}
                    };
                }

                var p = item.DynPlant;
                if (p) {
                    var d = oResult[sKey]._dyn;
                    d["PurPrice_" + p]    = item.DynPurPrice;
                    d["PurCrcy_" + p]     = item.DynPurCurrency;
                    d["SlsPrice_" + p]    = item.DynSlsPrice;
                    d["SlsCrcy_" + p]     = item.DynSlsCurrency;
                    d["Status_" + p]      = item.DynExecStatus;
                    d["Msg_" + p]         = item.DynMessage;
                    d["LabelPur_" + p]    = item.DynColLabelPur;
                    d["LabelSls_" + p]    = item.DynColLabelSls;
                    d["LabelStatus_" + p] = item.DynColLabelStatus;
                    d["LabelMsg_" + p]    = item.DynColLabelMsg;
                }
            });

            return Object.values(oResult).map(function (o) {
                var d = o._dyn;
                delete o._dyn;
                return Object.assign(o, d);
            });
        },

        //================= 动态列追加（每工厂 采购价/销售价/状态/消息）=================
        _addColumns: function () {
            var aRows = this._oLocal.getProperty("/rows");
            if (!aRows.length) { return; }

            var oRow0 = aRows[0];
            var aPlants = Object.keys(oRow0)
                .filter(function (k) { return k.indexOf("PurPrice_") === 0; })
                .map(function (k) { return k.substring("PurPrice_".length); })
                .sort();

            // 每工厂6列：采购价格/采购货币/销售价格/销售货币/状态/消息。
            // 货币列头由价格列头替换"价格"→"货币"得到（同一列不同行币别可能不同，
            // 所以货币按行单独成列，价格列头不再带币别）
            aPlants.forEach(function (p) {
                var sLabelPur = oRow0["LabelPur_" + p] || "";
                var sLabelSls = oRow0["LabelSls_" + p] || "";
                this._addNumCol("PurPrice_" + p, sLabelPur);
                this._addTextCol("PurCrcy_" + p, sLabelPur.replace("价格", "货币"), "7rem");
                this._addNumCol("SlsPrice_" + p, sLabelSls);
                this._addTextCol("SlsCrcy_" + p, sLabelSls.replace("价格", "货币"), "7rem");
                this._addStatusCol("Status_" + p, oRow0["LabelStatus_" + p]);
                this._addTextCol("Msg_" + p, oRow0["LabelMsg_" + p], "22rem");
            }.bind(this));
        },

        // 状态动态列：红绿灯 ObjectStatus（复用与页签2/3 同一个 formatter）
        _addStatusCol: function (sProp, sLabel) {
            var oColumn = new UIColumn({
                width: "8rem",
                label: new Label({ text: sLabel || sProp }),
                template: new ObjectStatus({
                    state: { path: "local>" + sProp, formatter: formatter.setState },
                    icon:  { path: "local>" + sProp, formatter: formatter.setStateIcon }
                })
            });
            this.byId("idPriceTable").addColumn(oColumn);
            this._aDynCols.push(oColumn);
        },

        // 数值动态列（6位小数）
        _addNumCol: function (sProp, sLabel) {
            var oColumn = new UIColumn({
                width: "14rem",
                hAlign: "End",
                label: new Label({ text: sLabel || sProp }),
                template: new Text({
                    text: {
                        path: "local>" + sProp,
                        type: "sd.zicprice.model.CustomDecimal"
                    },
                    wrapping: false
                })
            });
            this.byId("idPriceTable").addColumn(oColumn);
            this._aDynCols.push(oColumn);
        },

        // 文本动态列（状态 / 消息）
        _addTextCol: function (sProp, sLabel, sWidth) {
            var oColumn = new UIColumn({
                width: sWidth || "10rem",
                label: new Label({ text: sLabel || sProp }),
                template: new Text({ text: "{local>" + sProp + "}", wrapping: false })
            });
            this.byId("idPriceTable").addColumn(oColumn);
            this._aDynCols.push(oColumn);
        },

        _removeDynamicColumns: function () {
            var oTable = this.byId("idPriceTable");
            (this._aDynCols || []).forEach(function (oCol) {
                oTable.removeColumn(oCol);
                oCol.destroy();
            });
            this._aDynCols = [];
        },

        //================= 执行按钮（改采购价 / 改销售价）=================
        onRefreshPurchase: function () {
            this._execute("REFRESH_PUR");
        },

        onRefreshSales: function () {
            this._execute("REFRESH_SLS");
        },

        _execute: function (sEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oTable = this.byId("idPriceTable");
            var aIdx = oTable.getSelectedIndices();

            if (!aIdx.length) {
                MessageBox.error(oBundle.getText("msgSelectRow"));
                return;
            }

            // 选中的宽表行 → 找回对应的【整条窄行】回传（不只是key）
            var aRows = this._oLocal.getProperty("/rows");
            var aNarrow = this._aNarrow || [];
            var aSelected = [];

            aIdx.forEach(function (i) {
                var oWide = aRows[i];
                aNarrow.forEach(function (n) {
                    var bMatch = KEY_FIELDS.every(function (f) {
                        return String(n[f]) === String(oWide[f]);
                    });
                    if (!bMatch || !n.DynPlant) { return; }
                    // 改采购价：跳过没维护供应商BP的工厂（否则纯报错噪音）
                    if (sEvent === "REFRESH_PUR" && !n.DynSupplier) { return; }
                    aSelected.push(this._cleanRow(n));
                }.bind(this));
            }.bind(this));

            if (!aSelected.length) {
                MessageBox.error(oBundle.getText("msgNoExecutable"));
                return;
            }

            // 工厂权限校验（防止查询后改工厂再执行）：对实际要改的工厂
            var aExecPlants = aSelected.map(function (r) { return r.DynPlant; })
                .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
            if (!this.checkPlantAuthority(aExecPlants)) {
                return;
            }

            var oPayload = this._buildPayload(aSelected);

            this._oBusy.open();
            this.postAction(JSON.stringify(oPayload), sEvent).then(function (oData) {
                var oRes = oData && oData.processLogic;
                var sZzkey = oRes && oRes.Zzkey ? oRes.Zzkey : "";
                if (oRes && oRes.Event === "MESSAGE") {
                    MessageBox.error(sZzkey);
                } else {
                    MessageBox.information(sZzkey, {
                        onClose: function () { this.onSearch(); }.bind(this)  // 执行完重查刷新状态
                    });
                }
            }.bind(this)).catch(function (oError) {
                MessageBox.error(this.extractError(oError));
            }.bind(this)).finally(function () {
                this._oBusy.close();
            }.bind(this));
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

        // 组装 processLogic 的 Zzkey payload（filter 保留 + 选中整行）
        _buildPayload: function (aSelected) {
            var oSFB = this.byId("idSmartFilterBar");
            var oData = oSFB.getFilterData();
            var oDR = this.byId("idDRValidity");

            return {
                SalesOrganization: oData.SalesOrganization || "",
                Material:    this._toRange(oData.Material),
                SoldToParty: this._toRange(oData.SoldToParty),
                BillToParty: this._toRange(oData.BillToParty),
                Plant:       this._toRange(oData.DynPlant),
                ValidityFrom: oDR && oDR.getDateValue() ? this._fmtDate(oDR.getDateValue()) : "",
                ValidityTo:   oDR && oDR.getSecondDateValue() ? this._fmtDate(oDR.getSecondDateValue()) : "",
                Selected: aSelected
            };
        },

        _toRange: function (oField) {
            var aOut = [];
            if (!oField) { return aOut; }
            if (typeof oField === "string") {
                if (oField) { aOut.push({ sign: "I", option: "EQ", low: oField, high: "" }); }
                return aOut;
            }
            (oField.items || []).forEach(function (it) {
                aOut.push({ sign: "I", option: "EQ", low: it.key, high: "" });
            });
            (oField.ranges || []).forEach(function (r) {
                aOut.push({
                    sign: r.exclude ? "E" : "I",
                    option: r.operation === "BT" ? "BT" : (r.operation || "EQ"),
                    low: r.value1 != null ? String(r.value1) : "",
                    high: r.value2 != null ? String(r.value2) : ""
                });
            });
            return aOut;
        },

        _fmtDate: function (oDate) {
            var y = oDate.getFullYear();
            var m = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var d = ("0" + oDate.getDate()).slice(-2);
            return "" + y + m + d;
        }
    });
});