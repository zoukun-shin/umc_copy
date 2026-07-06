sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "./messages",
    "sap/ui/model/Filter",
    "sap/m/BusyDialog",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (
    BaseController,
    formatter,
    messages,
    Filter,
    BusyDialog,
    Fragment,
    JSONModel,
    MessageBox
) {
    "use strict";

    return BaseController.extend("pp.internalpogr.controller.InternalPost", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();

            var oRouter = this.getRouter();
            oRouter.getRoute("RouteMain").attachMatched(this._onRouteMatched, this);
        },

        onSearch: function () {
            this.errorPopup = false;
            var aFilter = this.getView().byId("idSmartFilterBar").getFilters();

            this.getEntityCount(aFilter).then(function (iItemCount) {
                if (iItemCount > 0) {
                    this._LocalData.setProperty("/InternalPOGR", []);
                    this._LocalData.setProperty("/InternalPOGRTemp", []);
                    this.getEntityContentOnePage(iItemCount, 0, aFilter, undefined);
                } else {
                    this._LocalData.setProperty("/InternalPOGR", []);
                    this.byId("idDynamicPage").setBusy(false);
                }
            }.bind(this));
        },

        getEntityCount: function (aFilter) {
            var that = this;
            that.byId("idDynamicPage").setBusyIndicatorDelay(0);
            that.byId("idDynamicPage").setBusy(true);

            return new Promise(function (resolve) {
                var mParameters = {
                    urlParameters: { FgOnly: "X" },
                    filters: aFilter,
                    success: function (oData) {
                        resolve(Number(oData));
                    },
                    error: function (oError) {
                        resolve(0);
                        that.byId("idDynamicPage").setBusy(false);

                        var sErrorMessage;
                        try {
                            var oJsonMessage = JSON.parse(oError.responseText);
                            sErrorMessage = oJsonMessage.error.message.value;
                        } catch (e) {
                            sErrorMessage = oError.responseText;
                        }
                        MessageBox.error(sErrorMessage);
                    }
                };

                that.getOwnerComponent().getModel().read("/InternalPOGR/$count", mParameters);
            });
        },

        getEntityContentOnePage: function (iTop, iSkip, aFilter, sParamtetrsOfSelect) {
            sParamtetrsOfSelect = sParamtetrsOfSelect ? sParamtetrsOfSelect : "";
            var that = this;
            this.aHttpRequest = [];
            that.byId("idDynamicPage").setBusy(true);
            that.dataFinished = false;

            var aResultTemp = that._LocalData.getProperty("/InternalPOGRTemp");

            var promise = new Promise(function (resolve, reject) {
                var mParameters = {
                    filters: aFilter,
                    urlParameters: {
                        "$top": iTop,
                        "$skiptoken": iSkip,
                        "$select": sParamtetrsOfSelect
                    },
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            aResultTemp.push.apply(aResultTemp, oData.results);
                            that._LocalData.setProperty("/InternalPOGR", aResultTemp);
                        }
                        resolve(oData);
                    },
                    error: function (oError) {
                        if (!oError.aborted) {
                            that.byId("idDynamicPage").setBusy(false);

                            var sErrorMessage;
                            try {
                                var oJsonMessage = JSON.parse(oError.responseText);
                                sErrorMessage = oJsonMessage.error.message.value;
                            } catch (e) {
                                sErrorMessage = oError.responseText;
                            }

                            sErrorMessage = sErrorMessage + that._ResourceBundle.getText("DataError");

                            if (!that.errorPopup) {
                                MessageBox.error(sErrorMessage);
                                that.errorPopup = true;
                                that._LocalData.setProperty("/InternalPOGR", []);
                            }

                            that.aHttpRequest.forEach(function (req) {
                                req.abort();
                            });

                            reject();
                        }
                    }
                };

                that.getOwnerComponent().getModel().setUseBatch(false);
                that.aHttpRequest.push(that.getOwnerComponent().getModel().read("/InternalPOGR", mParameters));
            });

            promise.then(function (oData) {
                if (oData.__next) {
                    iSkip = iSkip + 5000;
                    that.getEntityContentOnePage(iTop, iSkip, aFilter, sParamtetrsOfSelect);
                } else {
                    var aResultTemp2 = that._LocalData.getProperty("/InternalPOGRTemp");
                    var aResult = that.transformData(aResultTemp2);

                    that._LocalData.setProperty("/InternalPOGR", aResult);
                    that.aHttpRequest = [];
                    that._LocalData.refresh();
                    that.dataFinished = true;
                    that.byId("idDynamicPage").setBusy(false);
                }
            });
        },

        transformData: function (data) {
            return data.map(function (item) {
                delete item.__metadata;
                return item;
            });
        },

        _onRouteMatched: function () {
            this.getView().getModel().resetChanges();
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
        },

        onBeforeRebindTable: function (oEvent) {
            this._oDataModel.resetChanges();
            oEvent.getParameters().bindingParams.filters;
        },

        onCheck: function () {
            var aSelectedItems = this.preparePostBody();

            if (aSelectedItems.length === 0) {
                MessageBox.error(this._ResourceBundle.getText("postNoSelection"));
                return;
            }

            this.postAction("Check", JSON.stringify(aSelectedItems));
        },

        onPost: function () {
            var aSelectedItems = this.preparePostBody();

            if (aSelectedItems.length === 0) {
                MessageBox.error(this._ResourceBundle.getText("postNoSelection"));
                return;
            }

            var bHasError = aSelectedItems.some(function (item) {
                return item.ProcessStatus === "E";
            });

            if (bHasError) {
                MessageBox.error(this._ResourceBundle.getText("postContainsError"));
                return;
            }

            var bInvalid = aSelectedItems.some(function (item) {
                return item.ProcessStatus !== "S";
            });

            if (bInvalid) {
                MessageBox.error(this._ResourceBundle.getText("postOnlySuccess"));
                return;
            }

            this.postAction("Post", JSON.stringify(aSelectedItems));
        },

        preparePostBody: function () {
            var oTable = this.byId("reportTable1");
            var aSelectedIdx = oTable.getSelectedIndices();
            var oLocalModel = this.getModel("local");
            var aRows = [];
            var aSelectedDataIndex = [];

            aSelectedIdx.forEach(function (idx) {
                var oCtx = oTable.getContextByIndex(idx);
                if (!oCtx) {
                    return;
                }

                var sPath = oCtx.getPath();
                var iDataIndex = parseInt(sPath.split("/").pop(), 10);
                var oRow = Object.assign({}, oLocalModel.getObject(sPath));

                delete oRow.__metadata;

                aRows.push(oRow);
                aSelectedDataIndex.push(iDataIndex);
            });

            this._aSelectedDataIndexForAction = aSelectedDataIndex;

            return aRows;
        },

        _mapBackendRow: function (r) {
            var mFieldMap = {
                UUID: "UUID",
                PLANT: "Plant",
                DELIVERYNOTENO: "DeliveryNoteNo",
                DELIVERYNOTEITEMNO: "DeliveryNoteItemNo",
                DELIVERYMATERIAL: "DeliveryMaterial",
                RECEIPTMATERIAL: "ReceiptMaterial",
                PROCESSRESULT: "ProcessResult",
                PROCESSSTATUS: "ProcessStatus",
                PONO: "PoNo",
                POITEMNO: "PoItemNo",
                MATERIALDOCUMENTNO: "MaterialDocumentNo",
                MATERIALDOCUMENTITEMNO: "MaterialDocumentItemNo",
                POSTQTY: "PostQty",
                DELIVERYQUANTITYUNIT: "DeliveryQuantityUnit",
                MATERIALDOCUMENTYEAR: "MaterialDocumentYear",
                DDSTORAGELOCATION: "DDStorageLocation",
                POSTORAGELOCATION: "POStorageLocation",
                REVERSEDIND: "ReversedInd",
                REVERSEDMATDOCUMENT: "ReversedMatDocument",
                POSTINGDATE: "PostingDate",
                REVERSEDPOSTINGDATE: "ReversedPostingDate",
                ORDERQUANTITY: "OrderQuantity",
                PURCHASEORDERQUANTITYUNIT: "PurchaseOrderQuantityUnit",
                TOTALQUANTITY: "TotalQuantity"
            };

            var out = {};
            Object.keys(r || {}).forEach(function (k) {
                out[mFieldMap[k] || k] = r[k];
            });
            return out;
        },

        _updateLocalModelByResult: function (result) {
            var oLocalModel = this.getModel("local");
            var aAllRows = oLocalModel.getProperty("/InternalPOGR") || [];
            var aSelectedDataIndex = this._aSelectedDataIndexForAction || [];
            var aNewRows = aAllRows.slice();

            result.forEach(function (r, i) {
                var iDataIndex = aSelectedDataIndex[i];
                if (iDataIndex === undefined || !aNewRows[iDataIndex]) {
                    return;
                }

                var oMapped = this._mapBackendRow(r);
                aNewRows[iDataIndex] = Object.assign({}, aNewRows[iDataIndex], oMapped);
            }.bind(this));

            oLocalModel.setProperty("/InternalPOGR", aNewRows);
            oLocalModel.refresh(true);
        },

        postAction: function (sAction, postData) {
            this._BusyDialog.open();
            var oModel = this._oDataModel;

            oModel.callFunction("/processLogic", {
                method: "POST",
                changeSetId: 0,
                urlParameters: {
                    Event: sAction,
                    Zzkey: postData
                },

                success: function (oData) {
                    try {
                        var result = [];

                        try {
                            result = JSON.parse((oData && oData.processLogic && oData.processLogic.Zzkey) || "[]");
                        } catch (e) {
                            messages.showError(this._ResourceBundle.getText("BackError"));
                            return;
                        }

                        this._updateLocalModelByResult(result);

                    } finally {
                        this._BusyDialog.close();
                    }
                }.bind(this),

                error: function (oError) {
                    try {
                        this._LocalData.setProperty("/recordCheckSuccessed", false);
                        messages.showError(messages.parseErrors(oError));
                    } finally {
                        this._BusyDialog.close();
                    }
                }.bind(this)
            });
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "CreateAt":
                    case "ChnageAt":
                        oColumn.type = sap.ui.export.EdmType.DateTime;
                        break;
                }
            });
        }
    });
});