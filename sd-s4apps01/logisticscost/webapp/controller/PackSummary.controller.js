sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "./messages",
    "../model/formatter"
], function(Controller, Filter, messages, formatter) {
    "use strict";

    var CONFIRM_CHANNEL_ID = "packSummary";
    var CONFIRM_EVENT_ID = "confirmAbandonChanges";

    return Controller.extend("sd.logisticscost.controller.PackSummary", {

        formatter: formatter,

        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new sap.m.BusyDialog();

            // 注册“放弃未保存修改”确认回调
            this.getOwnerComponent().getEventBus().subscribe(
                CONFIRM_CHANNEL_ID,
                CONFIRM_EVENT_ID,
                this._onConfirmAbandonChanges,
                this
            );
        },

        onBeforeRebindTable: function(oEvent) {
            var oBindingParams = oEvent.getParameter("bindingParams");
            var oFilter = oBindingParams.filters;
            var aNewFilter = [];

            var oDateRange = this.byId("idDRPlannedGoodsIssueDate");
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();
            if (oStartDate && oEndDate) {
                aNewFilter.push(new Filter(
                    "PlannedGoodsIssueDate", "BT",
                    formatter.odataDate(oStartDate),
                    formatter.odataDate(oEndDate)
                ));
            }

            if (aNewFilter.length > 0) {
                oFilter.push(new Filter({ filters: aNewFilter, and: true }));
            }
        },

        /**
         * “编辑”/“显示”按钮点击。
         * 编辑模式下点击切换回显示模式；显示模式下点击进入编辑模式。
         */
        onEditPress: function() {
            var bEditMode = this._LocalData.getProperty("/packSummaryEditMode");

            if (bEditMode) {
                this._switchToDisplayMode();
            } else {
                this._LocalData.setProperty("/packSummaryEditMode", true);
            }
        },

        /**
         * “保存”按钮点击：获取待提交修改，调用 processLogic action 保存。
         */
        onSavePress: function() {
            var oModel = this._oDataModel;
            var mPendingChanges = oModel.getPendingChanges();

            if (!mPendingChanges || Object.keys(mPendingChanges).length === 0) {
                messages.showInformation(this._ResourceBundle.getText("msgNoChanges"));
                return;
            }

            var aChangedData = [];
            Object.keys(mPendingChanges).forEach(function(sPath) {
                var sAbsolutePath = sPath.charAt(0) === "/" ? sPath : "/" + sPath;
                var oEntity = oModel.getProperty(sAbsolutePath);
                if (oEntity) {
                    aChangedData.push({
                        BillingDocument: oEntity.BillingDocument,
                        ActualFreight: oEntity.ActualFreight,
                        FreightRate: oEntity.FreightRate
                    });
                }
            });

            this._callProcessLogic(aChangedData);
        },

        /**
         * 可编辑字段统一 change 事件：通过 setProperty 更新对应 OData 条目。
         */
        onChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext();
            if (!oContext) {
                return;
            }

            var sPropertyPath = oSource.getBindingPath("value");
            if (sPropertyPath.charAt(0) === "/") {
                sPropertyPath = sPropertyPath.substring(1);
            }
            this._oDataModel.setProperty(sPropertyPath, oEvent.getParameter("value"), oContext);
        },

        /**
         * 从编辑模式切换为显示模式：若有未保存修改则提醒确认。
         */
        _switchToDisplayMode: function() {
            var oModel = this._oDataModel;
            if (oModel.hasPendingChanges()) {
                messages.confirmAction(
                    this._ResourceBundle.getText("msgConfirmTitle"),
                    this._ResourceBundle.getText("msgAbandonChanges"),
                    CONFIRM_CHANNEL_ID,
                    CONFIRM_EVENT_ID,
                    this
                );
            } else {
                this._LocalData.setProperty("/packSummaryEditMode", false);
            }
        },

        /**
         * 确认放弃修改：清空待提交修改并切换回显示模式。
         */
        _onConfirmAbandonChanges: function() {
            this._oDataModel.resetChanges();
            this._LocalData.setProperty("/packSummaryEditMode", false);
        },

        /**
         * 调用后端 OData action processLogic 保存修改。
         */
        _callProcessLogic: function(aChangedData) {
            var oModel = this._oDataModel;
            this._BusyDialog.open();
            oModel.callFunction("/processLogic", {
                method: "POST",
                urlParameters: {
                    Event: "SAVE_SUMMARY",
                    Zzkey: JSON.stringify(aChangedData)
                },
                success: function() {
                    oModel.resetChanges();
                    this._LocalData.setProperty("/packSummaryEditMode", false);
                    oModel.refresh();
                    this._BusyDialog.close();
                    messages.showSuccess(this._ResourceBundle.getText("msgSaveSuccess"));
                }.bind(this),
                error: function(oError) {
                    this._BusyDialog.close();
                    messages.showError(messages.parseErrors(oError));
                }.bind(this)
            });
        }
    });
});
