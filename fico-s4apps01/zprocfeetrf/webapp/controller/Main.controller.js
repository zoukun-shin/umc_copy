sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
    "use strict";

    const ENTITY_SET = "ProcFeeTrf";

    return Base.extend("fico.zprocfeetrf.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._BusyDialog = new BusyDialog();
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-View")) {
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
                this.getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View:   aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-View"),
                        Post:   aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-Post"),
                        Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zprocfeetrf-Cancel")
                    },
                    data: {
                        PlantSet:   context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet:    context._AssignRole
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

        onAfterRendering: function () {
            this._setActionButtonsByPostingStatus();
        },

        onSearch: function () {
            this._setActionButtonsByPostingStatus();
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            if (this._oDataModel.hasPendingChanges()) {
                this._oDataModel.resetChanges();
            }

            // 公司代码权限校验
            var sBukrs = this.byId("SFBProcFeeTrf").getFilterData().CompanyCode;
            var aAuthorityCompanySet = this.getModel("local").getProperty("/authorityCheck/data/CompanySet");
            if (!aAuthorityCompanySet.some(data => data.CompanyCode === sBukrs)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityCompanyCode", [sBukrs]));
                mBindingParams.preventTableBind = true;
                return;
            }

            // 自定义筛选条件：PostingStatus
            var sPostingStatus = this.byId("PostingStatusSelect").getSelectedKey();
            this._removeFilterByPath(mBindingParams.filters, "PostingStatus");
            if (sPostingStatus) {
                mBindingParams.filters.push(new Filter("PostingStatus", FilterOperator.EQ, sPostingStatus));
            }

            // 自定义筛选条件：FiscalYear
            var oGjahr = new Date(this.byId("idGjahr").getValue());
            mBindingParams.filters.push(new Filter("FiscalYear", FilterOperator.EQ, oGjahr.getFullYear()));

            // 自定义筛选条件：FiscalPeriod
            var sMonat = this.byId("idMonat").getSelectedKey();
            mBindingParams.filters.push(new Filter("FiscalPeriod", FilterOperator.EQ, sMonat));

            this._setActionButtonsByPostingStatus();
        },

        _removeFilterByPath: function (aFilters, sPath) {
            for (var i = aFilters.length - 1; i >= 0; i--) {
                if (aFilters[i].sPath === sPath) {
                    aFilters.splice(i, 1);
                }
            }
        },

        onPostingStatusChange: function () {
            this._setActionButtonsByPostingStatus();
        },

        _setActionButtonsByPostingStatus: function () {
            var oStatusSelect  = this.byId("PostingStatusSelect");
            var oPostButton    = this.byId("btnPost");
            var oCancelButton  = this.byId("btnCancel");

            if (!oStatusSelect || !oPostButton || !oCancelButton) {
                return;
            }

            var sPostingStatus = oStatusSelect.getSelectedKey();
            oPostButton.setVisible(sPostingStatus === "1");
            oCancelButton.setVisible(sPostingStatus === "2");
        },

        onPost: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var aIndices = oTable.getSelectedIndices();

            if (aIndices.length === 0) {
                this._selectAllRows();
            }
            if (this._hasPostedAccountingDocument()) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("NotPostRepeatedly"));
                return;
            }
            var oBundle = this.getModel("i18n").getResourceBundle();
            MessageBox.confirm(
                oBundle.getText("postConfirmMsg"),
                {
                    title: oBundle.getText("postConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._selectAllRows();
                            this._executeAction("POST");
                        }
                    }.bind(this)
                }
            );
        },

        onCancel: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var aIndices = oTable.getSelectedIndices();

            if (aIndices.length === 0) {
                this._selectAllRows();
            }
            if (this._hasReversedAccountingDocument()) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("NotReversedRepeatedly"));
                return;
            }
            var oBundle = this.getModel("i18n").getResourceBundle();
            MessageBox.confirm(
                oBundle.getText("cancelConfirmMsg"),
                {
                    title: oBundle.getText("cancelConfirmTitle"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this._selectAllRows();
                            this._executeAction("CANCEL");
                        }
                    }.bind(this)
                }
            );
        },

        onExport: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) { return; }

            var aData = [];
            var iLength = oBinding.getLength();
            for (var i = 0; i < iLength; i++) {
                var oContext = oBinding.getContextByIndex(i);
                var oRow     = oContext && oContext.getObject();
                if (oRow) { aData.push(oRow); }
            }

            sap.ui.require(["sap/ui/export/Spreadsheet"], function (Spreadsheet) {
            var aColumns = [
                { label: this.getModel("i18n").getResourceBundle().getText("Status"),                          property: "Status" },
                { label: this.getModel("i18n").getResourceBundle().getText("Message"),                         property: "Message" },
                { label: this.getModel("i18n").getResourceBundle().getText("CompanyCode"),                     property: "CompanyCode" },
                { label: this.getModel("i18n").getResourceBundle().getText("FiscalYear"),                      property: "FiscalYear" },
                { label: this.getModel("i18n").getResourceBundle().getText("FiscalPeriod"),                    property: "FiscalPeriod" },
                { label: this.getModel("i18n").getResourceBundle().getText("TargetCompanyCode"),               property: "TargetCompanyCode" },
                { label: this.getModel("i18n").getResourceBundle().getText("Product"),                         property: "Product" },
                { label: this.getModel("i18n").getResourceBundle().getText("Quantity"),                        property: "Quantity",                   type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("BaseUnit"),                        property: "BaseUnit" },
                { label: this.getModel("i18n").getResourceBundle().getText("DeliveryDocument"),                property: "DeliveryDocument" },
                { label: this.getModel("i18n").getResourceBundle().getText("DeliveryDocumentItem"),            property: "DeliveryDocumentItem" },
                { label: this.getModel("i18n").getResourceBundle().getText("AccountingDocument2200"),          property: "AccountingDocument2200" },
                { label: this.getModel("i18n").getResourceBundle().getText("LedgerGLLineItem2200"),            property: "LedgerGLLineItem2200" },
                { label: this.getModel("i18n").getResourceBundle().getText("SalesOrder2200"),                  property: "SalesOrder2200" },
                { label: this.getModel("i18n").getResourceBundle().getText("SalesOrderItem2200"),              property: "SalesOrderItem2200" },
                { label: this.getModel("i18n").getResourceBundle().getText("PurchasingDocument2000"),          property: "PurchasingDocument2000" },
                { label: this.getModel("i18n").getResourceBundle().getText("PurchasingDocumentItem2000"),      property: "PurchasingDocumentItem2000" },
                { label: this.getModel("i18n").getResourceBundle().getText("SalesOrder2000"),                  property: "SalesOrder2000" },
                { label: this.getModel("i18n").getResourceBundle().getText("SalesOrderItem2000"),              property: "SalesOrderItem2000" },
                { label: this.getModel("i18n").getResourceBundle().getText("Customer"),                        property: "Customer" },
                { label: this.getModel("i18n").getResourceBundle().getText("SalesOrganization"),               property: "SalesOrganization" },
                { label: this.getModel("i18n").getResourceBundle().getText("DistributionChannel"),             property: "DistributionChannel" },
                { label: this.getModel("i18n").getResourceBundle().getText("OrganizationDivision"),            property: "OrganizationDivision" },
                { label: this.getModel("i18n").getResourceBundle().getText("Plant"),                           property: "Plant" },
                { label: this.getModel("i18n").getResourceBundle().getText("ProfitCenter"),                    property: "ProfitCenter" },
                { label: this.getModel("i18n").getResourceBundle().getText("Amount2200Cny"),                   property: "Amount2200Cny",              type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("Amount2200Usd"),                   property: "Amount2200Usd",              type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("MaterialCost2200Cny"),             property: "MaterialCost2200Cny",        type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("MaterialCost2200Usd"),             property: "MaterialCost2200Usd",        type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("Amount2000PurchaseUsd"),           property: "Amount2000PurchaseUsd",      type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("Amount2000SalesUsd"),              property: "Amount2000SalesUsd",         type: "Number" },
                { label: this.getModel("i18n").getResourceBundle().getText("PostedCompanyCode"),               property: "PostedCompanyCode" },
                { label: this.getModel("i18n").getResourceBundle().getText("PostedFiscalYear"),                property: "PostedFiscalYear" },
                { label: this.getModel("i18n").getResourceBundle().getText("PostedPostingDate"),               property: "PostedPostingDate",          type: "Date" },
                { label: this.getModel("i18n").getResourceBundle().getText("PostedAccountingDocument"),        property: "PostedAccountingDocument" },
                { label: this.getModel("i18n").getResourceBundle().getText("ReversedCompanyCode"),             property: "ReversedCompanyCode" },
                { label: this.getModel("i18n").getResourceBundle().getText("ReversedFiscalYear"),              property: "ReversedFiscalYear" },
                { label: this.getModel("i18n").getResourceBundle().getText("ReversedPostingDate"),             property: "ReversedPostingDate",        type: "Date" },
                { label: this.getModel("i18n").getResourceBundle().getText("ReversedAccountingDocument"),      property: "ReversedAccountingDocument" }
            ];
                var oSheet = new Spreadsheet({
                    workbook:   { columns: aColumns },
                    dataSource: aData,
                    fileName: this.getModel("i18n").getResourceBundle().getText("Result") + ".xlsx"
                });
                oSheet.build().finally(function () { oSheet.destroy(); });
            }.bind(this));
        },

        _selectAllRows: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var oBinding = oTable && oTable.getBinding("rows");

            if (!oTable || !oBinding) { return; }

            var iLength = oBinding.getLength();
            oTable.clearSelection();
            if (iLength > 0) {
                oTable.addSelectionInterval(0, iLength - 1);
            }
        },

        _hasPostedAccountingDocument: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var oBinding = oTable && oTable.getBinding("rows");

            if (!oBinding) { return false; }

            var iLength = oBinding.getLength();
            for (var i = 0; i < iLength; i++) {
                var oContext = oBinding.getContextByIndex(i);
                var oRow     = oContext && oContext.getObject();
                if (oRow && oRow.PostedAccountingDocument) { return true; }
            }
            return false;
        },

        _hasReversedAccountingDocument: function () {
            var oTable   = this.byId("Table_ProcFeeTrf");
            var oBinding = oTable && oTable.getBinding("rows");

            if (!oBinding) { return false; }

            var iLength = oBinding.getLength();
            for (var i = 0; i < iLength; i++) {
                var oContext = oBinding.getContextByIndex(i);
                var oRow     = oContext && oContext.getObject();
                if (oRow && oRow.Status === "S") { return true; }
            }
            return false;
        },

        _executeAction: function (sEvent) {
            var postDocs              = this.preparePostBody();
            var sCurrentPostingStatus = this.byId("PostingStatusSelect").getSelectedKey();
            this._BusyDialog.open();

            Promise.all([this.postAction(postDocs, sEvent)]).then((oData) => {
                oData.forEach((item) => {
                    var message = item["processLogic"].Event;
                    if (message && message === "MESSAGE") {
                        MessageBox.error(item["processLogic"].Zzkey);
                        return;
                    }
                    var aResult = JSON.parse(item["processLogic"].Zzkey);
                    aResult.forEach(function (line) {
                        line.POSTINGSTATUS = sCurrentPostingStatus;
                        var sKey = this._buildEntityKey(line);
                        if (!sKey) { return; }

                        this._setIfExists(sKey, "Status",  line.STATUS  || line.Status);
                        this._setIfExists(sKey, "Message", line.MESSAGE || line.Message);

                        this._setIfExists(sKey, "PostedCompanyCode",        line.POSTEDCOMPANYCODE        || line.PostedCompanyCode);
                        this._setIfExists(sKey, "PostedPostingDate",        line.POSTEDPOSTINGDATE        || line.PostedPostingDate);
                        this._setIfExists(sKey, "PostedFiscalYear",         line.POSTEDFISCALYEAR         || line.PostedFiscalYear);
                        this._setIfExists(sKey, "PostedAccountingDocument", line.POSTEDACCOUNTINGDOCUMENT || line.PostedAccountingDocument);

                        this._setIfExists(sKey, "ReversedCompanyCode",        line.REVERSEDCOMPANYCODE        || line.ReversedCompanyCode);
                        this._setIfExists(sKey, "ReversedPostingDate",        line.REVERSEDPOSTINGDATE        || line.ReversedPostingDate);
                        this._setIfExists(sKey, "ReversedFiscalYear",         line.REVERSEDFISCALYEAR         || line.ReversedFiscalYear);
                        this._setIfExists(sKey, "ReversedAccountingDocument", line.REVERSEDACCOUNTINGDOCUMENT || line.ReversedAccountingDocument);
                    }, this);
                });
            }).catch((error) => {
                MessageBox.error(error.message || error.responseText || String(error));
            }).finally(() => {
                this._BusyDialog.close();
            });
        },

        preparePostBody: function () {
            var oTable       = this.byId("Table_ProcFeeTrf");
            var aIndices     = oTable.getSelectedIndices();
            var selectedRows = [];

            aIndices.forEach((iIndex) => {
                var sPath = oTable.getContextByIndex(iIndex).getPath();
                var oRow  = Object.assign({}, this.getModel().getObject(sPath));
                delete oRow.__metadata;
                selectedRows.push(oRow);
            });

            return [JSON.stringify(selectedRows)];
        },

        postAction: function (postData, bEvent) {
            return new Promise(function (resolve, reject) {
                this.getModel().callFunction("/processLogic", {
                    success: function (oData) { resolve(oData); },
                    error:   function (oError) { reject(oError); },
                    method:  "POST",
                    urlParameters: {
                        Zzkey: postData,
                        Event: bEvent
                    }
                });
            }.bind(this));
        },

        _setIfExists: function (sKey, sProperty, vValue) {
            if (vValue !== undefined && vValue !== null) {
                this._oDataModel.setProperty(sKey + "/" + sProperty, vValue);
            }
        },

        _buildEntityKey: function (line) {
            var sCompanyCode           = line.COMPANYCODE           || line.CompanyCode;
            var sFiscalYear            = line.FISCALYEAR            || line.FiscalYear;
            var sFiscalPeriod          = line.FISCALPERIOD          || line.FiscalPeriod;
            var sDeliveryDocument      = line.DELIVERYDOCUMENT      || line.DeliveryDocument;
            var sDeliveryDocumentItem  = line.DELIVERYDOCUMENTITEM  || line.DeliveryDocumentItem;

            if (!sCompanyCode || !sFiscalYear || !sFiscalPeriod || !sDeliveryDocument || !sDeliveryDocumentItem) {
                return "";
            }

            return "/" + ENTITY_SET +
                "(CompanyCode='"           + sCompanyCode          +
                "',FiscalYear='"           + sFiscalYear           +
                "',FiscalPeriod='"         + sFiscalPeriod         +
                "',DeliveryDocument='"     + sDeliveryDocument     +
                "',DeliveryDocumentItem='" + sDeliveryDocumentItem +
                "')";
        }
    });
});