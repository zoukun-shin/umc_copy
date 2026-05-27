sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "../model/formatter",
    "./messages",
    "sap/m/BusyDialog",
    "sap/ui/core/Messaging",
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/ui/model/Filter",
], (Controller, formatter, messages, BusyDialog, Messaging, Fragment, Dialog, Filter) => {
    "use strict";

    return Controller.extend("fico.salesbillingposting.controller.Main", {
        formatter:formatter,

        onInit() {
            // this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
            this._suppressRowSelection = false;
            var oTable = this.byId("reportTable1");
            if (oTable) {
                oTable.attachRowSelectionChange(this.onRowSelectionChange.bind(this));
            }
        },

        onBeforeRebindTable: function (oEvent) {
            var oFilter = oEvent.getParameter("bindingParams").filters;
			var oNewFilter, aNewFilter = [], aNewFilterOR = [];
            var oBillingDocumentDate = this.byId("idDatePickerBillingDocumentDate");
			if (oBillingDocumentDate.getValue() !== "") {
				var dPerioFrom = oBillingDocumentDate.getFrom();
				var dPerioTo = oBillingDocumentDate.getTo();
				aNewFilter.push(new Filter("BillingDocumentDate", "BT", formatter.odataDate(dPerioFrom), formatter.odataDate(dPerioTo) )); 
			}
			var sKey = this.byId("idAccountingPostingStatusSelect").getSelectedKey();
            if (sKey === "Posted") {
                aNewFilterOR.push(new Filter("AccountingPostingStatus", "EQ", "C"));
                aNewFilterOR.push(new Filter("AccountingPostingStatus", "EQ", "H"));
                var oFilterOR = new Filter({
                    filters:aNewFilterOR,
                    and:false
                });
                aNewFilter.push(oFilterOR);
            } else if (sKey === "NotPosted") {
                aNewFilter.push(new Filter("AccountingPostingStatus", "NE", "H"));
                aNewFilter.push(new Filter("AccountingPostingStatus", "NE", "C"));
            }

            var sCancelKey = this.byId("idCancellationStatusSelect").getSelectedKey();
            if (sCancelKey === "ExcludeCancelled") {
                aNewFilter.push(new Filter("CancellationStatus", "EQ", "1"));
            }
			
			oNewFilter = new Filter({
				filters:aNewFilter,
				and:true
			});
			if (aNewFilter.length > 0) {
				oFilter.push(oNewFilter);
			}
        },

        onDialogPress: function (oEvent) {
            this.aSelectedData = this.getSelectedRows(oEvent);
            if (this.aSelectedData.length === 0) {
                return;
            }
            if (!this.Dialog) {
                var oView = this.getView();
                if (!this.Dialog) {
                    this.Dialog = Fragment.load({
                        id: oView.getId(),
                        name: "fico.salesbillingposting.view.BatchInput",
                        controller: this
                    }).then(function (oDialog) {
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    }.bind(this));
                }
            }
            this.Dialog.then(function (oDialog) {
                oDialog.open();
            }.bind(this));
        },

        onDialogConfirm: function () {
            var that = this;
            var oPostingDate = this.byId("idDatePickerPostingDate").getDateValue();
            if (!oPostingDate) {
                messages.showError(this._ResourceBundle.getText("msgSelectPostingDate"));
                return;
            }
            var sPostingDate = this.formatter.dateFormatter(oPostingDate,"yyyyMMdd");
            this.callAction(sPostingDate);
            this.byId("AnswerDialog").close();
        },

        onDialogClose: function () {
            this.byId("AnswerDialog").close();
            this.aNeedUpdateData = [];
        },

        callAction: function (sPostingDate) {
            var that = this;
            var oModel = this._oDataModel;
            oModel.resetChanges();
            oModel.callFunction("/processLogic", {
                method: "POST",
                urlParameters: {
                    Event: "POSTING",
                    Zzkey: JSON.stringify({
                        BillingDocumentDate: sPostingDate,
                        to_item: that.aSelectedData,
                    })
                },
                success: function (oData) {
                    let result = JSON.parse(oData['processLogic'].Zzkey);
                    result.forEach(function (line) {
                        let sKey = `/SalesBilling(BillingDocument='${line.BILLINGDOCUMENT}',BillingDocumentItem='${line.BILLINGDOCUMENTITEM}')`;
                        this._oDataModel.setProperty(sKey + "/Type", line.TYPE);
                        this._oDataModel.setProperty(sKey + "/Message", line.MESSAGE);
                    }, this);
                    this._BusyDialog.close();
                }.bind(this),
                error: function (oError) {
                    messages.showError(messages.parseErrors(oError));
                    this._BusyDialog.close();
                }.bind(this),
            });
            this._BusyDialog.open();
            oModel.submitChanges();
        },

        getSelectedRows: function (oEvent) {
            var that = this;
            // 获取按钮的上下文
            var oButton = oEvent.getSource();

            // 获取按钮所在的表格（假设是 sap.ui.table.Table）
            var oTable = oButton.getParent();

            // 遍历父控件找到 SmartTable 控件
            while (oTable && !(oTable instanceof sap.ui.table.Table || oTable instanceof sap.m.Table)) {
                oTable = oTable.getParent();
            }

            // 确保找到了表格控件
            if (!oTable) {
                console.log("未找到表格控件");
                return;
            }

            // 获取选中的行索引
            var aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                messages.showError(this._ResourceBundle.getText("msgNoSelect"));
                return [];
            }

            // 获取表格绑定的模型
            var oModel = oTable.getModel();

            // 存储选中的行数据
            var aSelectedData = [];

            // 遍历选中的行索引，获取行数据
            aSelectedIndices.forEach(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                var oRowData = oModel.getProperty(oContext.getPath());
                // var oCopyRowData = JSON.parse(JSON.stringify(oRowData));
                var oCopyRowData = {
                    BillingDocument: oRowData.BillingDocument,
                    BillingDocumentItem: oRowData.BillingDocumentItem,
                };
                aSelectedData.push(oCopyRowData);
            });

            return aSelectedData;
        },

        onRowSelectionChange: function (oEvent) {
            if (this._suppressRowSelection) {
                return;
            }
            var oTable = oEvent.getSource();
            var iRowIndex = oEvent.getParameter("rowIndex");
            if (typeof iRowIndex !== "number") {
                return;
            }
            var bSelected = oTable.isIndexSelected(iRowIndex);
            var oContext = oTable.getContextByIndex(iRowIndex);
            if (!oContext) {
                return;
            }
            var oRowData = oContext.getProperty ? oContext.getProperty() : oContext.getModel().getProperty(oContext.getPath());
            if (!oRowData || !oRowData.BillingDocument) {
                return;
            }
            var sBillingDocument = oRowData.BillingDocument;

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) {
                return;
            }

            var iLength = oBinding.getLength();
            if (typeof iLength !== 'number' || iLength < 0) {
                iLength = oTable.getBinding("rows").getContexts ? oTable.getBinding("rows").getContexts().length : 0;
            }

            this._suppressRowSelection = true;
            for (var i = 0; i < iLength; i++) {
                var oCtx = oTable.getContextByIndex(i); 
                // 由于odata分页查询，oTable中并不会包含所有数据，所以需要判断oCtx是否存在（目前也不处理所有数据，只处理当前页数据）
                if (!oCtx) {
                    continue;
                }
                var oData = oCtx.getProperty ? oCtx.getProperty() : oCtx.getModel().getProperty(oCtx.getPath());
                if (oData && oData.BillingDocument === sBillingDocument) {
                    if (bSelected) {
                        oTable.addSelectionInterval(i, i);
                    } else {
                        oTable.removeSelectionInterval(i, i);
                    }
                }
            }
            this._suppressRowSelection = false;
        },
    });
});