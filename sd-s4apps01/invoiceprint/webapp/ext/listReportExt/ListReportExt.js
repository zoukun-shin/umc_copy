sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/BusyDialog",
    "./messages",
    "../../lib/xml-js",
    "../../lib/decimal",
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (MessageToast, BusyDialog, messages, xml, decimal, Fragment, Dialog,Filter,FilterOperator) {
    'use strict';
    var _oFunctions, _ResourceBundle, _oDataModel, _oPrintModel, _UserInfo;
    return {
        init: function (oModels, oViews) {
            _oFunctions = this;

            _UserInfo = sap.ushell.Container.getService("UserInfo");

            // Authority Check
            var oAuthorityModel = oModels.Authority;
            var oLocalModel = oModels.local;
            var oI18nModel = oModels.i18n;
            this._getAuthorityData(oAuthorityModel, oLocalModel, oI18nModel, oViews);
        },
        _getAuthorityData: function (oAuthorityModel, oLocalModel, oI18nModel, oViews) {
            var sUser = _UserInfo.getFullName() === undefined ? "" : _UserInfo.getFullName();
            var sEmail = _UserInfo.getEmail() === undefined ? "" : _UserInfo.getEmail();
            // sEmail = "xinlei.xu@sh.shin-china.com";
            var oContextBinding = oAuthorityModel.bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: oI18nModel.getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    oViews.destroy();
                    this.oErrorMessageDialog.open();
                }
                oLocalModel.setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-Print"),
                        Reprint: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-Reprint"),
                        Clear: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-Clear"),
                        PrintTax: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-PrintTax"),
                        PrintCommercial: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-PrintCommercial"),
                        PrintVN: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-PrintVN"),
                        PrintTHShipping: aAllAccessBtns.some(btn => btn.AccessId === "invoiceprint-PrintTHShipping"),
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });
            }.bind(this), function (oError) {
                if (!this.oErrorMessageDialog) {
                    this.oErrorMessageDialog = new sap.m.Dialog({
                        type: sap.m.DialogType.Message,
                        state: "Error",
                        content: new sap.m.Text({
                            text: oI18nModel.getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                oViews.destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },
        onPrint: function (oEvent) {
            _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            this.sAction = "printInvoice";
            _oFunctions.onDialogPress(this.routing, this, this.sAction);

            // // 获取选择的行项目
            // if (this.getSelectedContexts) {
            //     var aSelectedContexts = this.getSelectedContexts();
            // }
            // _oFunctions.onCustomAction(aSelectedContexts,"printInvoice");

        },

        onReprint: function () {
            _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            this.sAction = "reprintInvoice";
            _oFunctions.onDialogPress(this.routing, this, this.sAction);
            // // 获取选择的行项目
            // if (this.getSelectedContexts) {
            //     var aSelectedContexts = this.getSelectedContexts();
            // }
            // _oFunctions.onCustomAction(aSelectedContexts,"reprintInvoice");
        },

        onDelete: function () {
            _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            this.sAction = "deleteInovice";
            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            _oFunctions.onCustomAction(aSelectedContexts, this.sAction);
        },

        onCustomAction: function (aSelectedContexts, sActionName, sPrintDate, sCreator, sApprover) {
            var aSelectedItem = [];
            var aPromise = [];
            var aItems = [];
            aSelectedContexts.forEach(function (item) {
                var itemObject = item.getObject();
                aSelectedItem.push(item.getObject());
                aItems.push({
                    BillingDocument: itemObject.BillingDocument,
                    BillingDocumentItem: itemObject.BillingDocumentItem,
                });
            });
            if (_oFunctions.checkInconsistencies(aSelectedItem)) {
                messages.showError(_ResourceBundle.getText("msgInconsistencies"));
                return;
            }

            aPromise.push(_oFunctions.printAction(aItems, sActionName));

            Promise.all(aPromise).then(function (records) {
                records.forEach(record => {
                    if (sActionName !== "deleteInovice") {
                        var pdfContent = _oFunctions.porcessPrintContent(record, sPrintDate, sCreator, sApprover);
                        _oFunctions.getPDF(pdfContent,"YY1_SD019");
                    } else {
                        messages.showSuccess(_ResourceBundle.getText("msgDeleteSuccessed"));
                    }
                });
            });
        },

        printAction: function (items, sActionName) {
            var oBusyDialog = new BusyDialog();
            var promise = new Promise(function (resolve, reject) {
                var oAction = _oDataModel.bindContext("/InvoiceReport/com.sap.gateway.srvd.zui_invoicereport_o4.v0001." + sActionName + "(...)");
                oAction.setParameter("Zzkey", JSON.stringify(items));
                oAction.setParameter("Event", "");
                oAction.setParameter("RecordUUID", "");
                oBusyDialog.open();
                oAction.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    oBusyDialog.close();
                    try {
                        var records = oAction.getBoundContext().getObject().value; //获取返回的数据
                    } catch (e) { }
                    resolve(records);
                }).catch((oError) => {
                    oBusyDialog.close();
                    messages.showError(oError.message);
                    reject(oError);
                });
            });
            return promise;
        },

        //接收到从action返回的数据后，处理成PDF需要的
        porcessPrintContent: function (aSelectedItem, sPrintDate, sCreator, sApprover) {
            // 检查选择的数据打印的维度是否一致，如果不一致则报错
            if (this.checkInconsistencies(aSelectedItem)) {
                messages.showError(_ResourceBundle.getText("msgInconsistencies"));
                return;
            }
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };
            //合计相关金额字段
            var iTotalNetAmount10 = 0,
                iTotalNetAmountTax10 = 0,
                iTotalNetAmountIncludeTax10 = 0,
                iTotalNetAmountExclude = 0;
            aSelectedItem.forEach(item => {
                iTotalNetAmount10 = Decimal.add(iTotalNetAmount10, item.NetAmount10);
                iTotalNetAmountExclude = Decimal.add(iTotalNetAmountExclude, item.NetAmountExclude);
            });
            iTotalNetAmount10 = iTotalNetAmount10.toFixed(0);
            iTotalNetAmountTax10 = Decimal.mul(iTotalNetAmount10, 0.1).toFixed(0);
            iTotalNetAmountIncludeTax10 = Decimal.add(iTotalNetAmount10, iTotalNetAmountTax10);
            iTotalNetAmountExclude = iTotalNetAmountExclude.toFixed(0);
            // 请求书抬头
            var InvoicePrint = {
                PrintDate: sPrintDate,
                // ADD BEGIN BY XINLEI XU 2025/01/14
                Creator: sCreator,
                Approver: sApprover,
                // ADD END BY XINLEI XU 2025/01/14
                InvoiceNo: aSelectedItem[0].InvoiceNo,
                TheCompanyPostalCode: aSelectedItem[0].TheCompanyPostalCode,
                TheCompanyName: aSelectedItem[0].TheCompanyName,
                TheCompanyCity: aSelectedItem[0].TheCompanyCity,
                TheCompanyTelNumber: aSelectedItem[0].TheCompanyTelNumber,
                TheCompanyFaxNumber: aSelectedItem[0].TheCompanyFaxNumber,
                PostalCode: aSelectedItem[0].PostalCode,
                CityName: aSelectedItem[0].CityName,
                CustomerName: aSelectedItem[0].CustomerName,
                TelephoneNumber1: aSelectedItem[0].TelephoneNumber1,
                FaxNumber: aSelectedItem[0].FaxNumber,
                TotalNetAmount: "", // Decimal(aSelectedItem[0].TotalNetAmount).toFixed(0), // MOD BY XINLEI XU 2025/05/29 CM#4423
                CompanyCodeParameterValue: "T" + aSelectedItem[0].CompanyCodeParameterValue, // aSelectedItem[0].CompanyCodeParameterValue, // MOD BY XINLEI XU 2025/06/19 CM#4423
                RemitAddress: aSelectedItem[0].RemitAddress,
                NetAmount10: iTotalNetAmount10.valueOf(),
                NetAmountTax10: iTotalNetAmountTax10.valueOf(),
                NetAmountIncludeTax10: iTotalNetAmountIncludeTax10.valueOf(),
                NetAmountExclude: iTotalNetAmountExclude.valueOf(),
                to_Item: {
                    results: []
                }
            }
            // ADD BEGIN BY XINLEI XU 2025/05/29 CM#4423
            InvoicePrint.TotalNetAmount = parseFloat(InvoicePrint.NetAmountIncludeTax10) + parseFloat(InvoicePrint.NetAmountExclude);
            // 请求书行项目
            var iIndex = 0;
            var results = [];
            aSelectedItem.forEach(item => {
                iIndex += 1;
                // ADD END BY XINLEI XU 2025/05/29 CM#4423
                results.push({
                    BillingDocumentItem: iIndex, // item.BillingDocumentItem, // MOD BY XINLEI XU 2025/05/29 CM#4423
                    BillingDocumentDate: item.BillingDocumentDate,
                    SalesDocument: item.SalesDocument,
                    MaterialByCustomer: item.MaterialByCustomer || item.Product,
                    BillingDocumentItemText: item.BillingDocumentItemText,
                    BillingQuantity: item.BillingQuantity,
                    UnitPrice: item.UnitPrice,
                    NetAmount: item.NetAmount,
                    TaxRate: item.TaxRate,
                    // ADD BEGIN BY XINLEI XU 2025/04/18 CM#4423
                    PurchaseOrderByCustomer: item.PurchaseOrderByCustomer,
                    YY1_ItemRemarks_1_BDI: item.YY1_ItemRemarks_1_BDI
                    // ADD END BY XINLEI XU 2025/04/18 CM#4423
                });
            });
            InvoicePrint.to_Item.results = results;
            pdfContent = {
                PrintData: InvoicePrint
            }
            return pdfContent;
        },
        onPrintVN: function() {
            
            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            let aItemVN = aSelectedContexts.filter(item => item.getObject()?.InvoicePrintType == "4");
            let aItemVNDR = aSelectedContexts.filter(item => item.getObject()?.InvoicePrintType == "5");
            let aItemVNCR = aSelectedContexts.filter(item => item.getObject()?.InvoicePrintType == "6");

            let aBillingDocumentVN = aItemVN.map(item => item.getObject()?.BillingDocument);
            let aBillingDocumentVNDR = aItemVNDR.map(item => item.getObject()?.BillingDocument);
            let aBillingDocumentVNCR = aItemVNCR.map(item => item.getObject()?.BillingDocument);
            aBillingDocumentVN = Array.from(new Set(aBillingDocumentVN));
            aBillingDocumentVNDR = Array.from(new Set(aBillingDocumentVNDR));
            aBillingDocumentVNCR = Array.from(new Set(aBillingDocumentVNCR));


            if (aBillingDocumentVN.length > 0) {
                _oFunctions.getBillingData(this,"BillingPrintVN","YY1_SD019_VN",aBillingDocumentVN);
            }
            if (aBillingDocumentVNDR.length > 0 || aBillingDocumentVNCR.length > 0) {
                //VNCD打印 需要输入日期
                _oFunctions.onPrintVNCD(this.routing, this, aBillingDocumentVNDR,aBillingDocumentVNCR);
            }
        },

        onPrintTHTax: function() {
            
            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            let aItemTH = aSelectedContexts.filter(item => item.getObject()?.InvoicePrintType == "7");
            let aBillingDocumentTH = aItemTH.map(item => item.getObject()?.BillingDocument);
            aBillingDocumentTH = Array.from(new Set(aBillingDocumentTH));

            if (aBillingDocumentTH.length > 0) {
                _oFunctions.getBillingData(this,"BillingPrintTH","YY1_SD019_TH",aBillingDocumentTH,"TAX INVOICE");
            }
        },
        onPrintTHCommercial: function() {
            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            let aItemTH = aSelectedContexts.filter(item => item.getObject()?.InvoicePrintType == "7");
            let aBillingDocumentTH = aItemTH.map(item => item.getObject()?.BillingDocument);
            aBillingDocumentTH = Array.from(new Set(aBillingDocumentTH));

            if (aBillingDocumentTH.length > 0) {
                _oFunctions.getBillingData(this,"BillingPrintTH","YY1_SD019_TH",aBillingDocumentTH,"COMMERCIAL INVOICE");
            }
        },
        onPrintTHShipping: function() {
            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            let aItemTH = aSelectedContexts.filter(item => item.getObject()?.InvoicePrintType == "8");
            let aBillingDocumentTH = aItemTH.map(item => item.getObject()?.BillingDocument);
            aBillingDocumentTH = Array.from(new Set(aBillingDocumentTH));

            if (aBillingDocumentTH.length > 0) {
                _oFunctions.getBillingData(this,"BillingPrintTH","YY1_SD019_TH_SP",aBillingDocumentTH,"SHIPPING INVOICE");
            }
        },

        onPrintVNCD: function (oRouting, that, aBillingDocumentVNDR,aBillingDocumentVNCR) {
            if (!this.Dialog) {
                var oView = oRouting.getView();
                if (!this.Dialog) {
                    this.Dialog = Fragment.load({
                        id: oView.getId(),
                        name: "sd.invoiceprint.ext.fragment.Dialog",
                        controller: that
                    }).then(function (oDialog) {
                        return oDialog;
                    }.bind(this));
                }
            }
            this.Dialog.then(function (oDialog) {
                oRouting.getView().addDependent(oDialog);
                oDialog.setBeginButton(new sap.m.Button({
                    text: "{i18n>bConfirm}",
                    press: function () {
                        let oIssuedDate;
                        var sPrintDate = oRouting.getView().byId("idPrintDate").getValue();
                        if (sPrintDate === '') {
                            oIssuedDate = new Date();
                        } else {
                            oIssuedDate = oRouting.getView().byId("idPrintDate").getDateValue();
                        }
                         sPrintDate = oIssuedDate.toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            }).replace(/\//g, '-'); // 将年月日间的分隔符改为"-"
                        if (aBillingDocumentVNDR.length > 0) {
                            _oFunctions.getBillingData(that,"BillingPrintVNCD","YY1_SD019_VN_CD",aBillingDocumentVNDR,"1",sPrintDate);
                        }
                        if (aBillingDocumentVNCR.length > 0) {
                            _oFunctions.getBillingData(that,"BillingPrintVNCD","YY1_SD019_VN_CD",aBillingDocumentVNCR,"2",sPrintDate);
                        }
                        oDialog.close();
                    }
                }));
                oDialog.setEndButton(new sap.m.Button({
                    text: "{i18n>bCancel}",
                    press: function () {
                        oDialog.close();
                    }
                }));
                oDialog.open();
            }.bind(this));
        },

        getBillingData: function(that,sEnetity,sTemplateID,aBillingDocument,sPrintType,sPrintDate){
            _oDataModel = that.getModel();
            _oPrintModel = that.getModel("Print");
            _ResourceBundle = that.getModel("i18n").getResourceBundle();
            
            var aFilters = [];
            var aNewFilter = [];
            aBillingDocument.forEach(function(item){
                aNewFilter.push(new Filter({
                    path: "BillingDocument",
                    operator: FilterOperator.EQ,
                    value1: item
                }));
            });
            
            let oNewFilter = new Filter({
				filters:aNewFilter,
				and:false
			});
            aFilters.push(oNewFilter);

            var oContextBinding = _oDataModel.bindList("/" + sEnetity, undefined, undefined, aFilters, {});
            
            //获取行项目数据
            var aPDFContent = [];
            var oItemPromise =  oContextBinding.requestContexts();
            oItemPromise.then(function(aContext){
                if (sEnetity === "BillingPrintVN") {
                    aPDFContent = _oFunctions.porcessVNCotent(aBillingDocument,aContext);
                } else if (sEnetity === "BillingPrintTH") {
                    aPDFContent = _oFunctions.porcessTHCotent(sPrintType,aBillingDocument,aContext);
                } else if (sEnetity === "BillingPrintVNCD") {
                    aPDFContent = _oFunctions.porcessVNCDContent(sPrintType,aBillingDocument,aContext,sPrintDate);
                }
               aPDFContent.forEach(pdfContent => {
                   _oFunctions.getPDF({"PrintData":pdfContent},sTemplateID);
               });
            });
        },

        porcessVNCotent: function(aHeader,aContext){
            var aPrintItem = [];
            var aBilling = [];
            for (const boundContext of aContext) {
                var object = boundContext.getObject();
                aPrintItem.push(object);
            }
            var aPrintData = [];
            aHeader.forEach(function(sKey){
                let aBillingItem = aPrintItem.filter(e => e.BillingDocument === sKey );
                let oFirstItem = aBillingItem[0];
                let oHeader ={
                    CompanyName: oFirstItem.CompanyName,
                    CompanyAddress: oFirstItem.CompanyAddress,
                    CompanyTelFax: oFirstItem.CompanyTelFax,
                    BillingDocument: oFirstItem.BillingDocument,
                    CreationDate: oFirstItem.CreationDate,
                    SoldToParty: oFirstItem.SoldToParty,
                    SoldToPartyName: oFirstItem.SoldToPartyName,
                    SoldToPartyStreet: oFirstItem.SoldToPartyStreet,
                    SoldToPartyCity: oFirstItem.SoldToPartyCity,
                    ShipToParty: oFirstItem.ShipToParty,
                    ShipToPartyName: oFirstItem.ShipToPartyName,
                    ShipToPartyStreet: oFirstItem.ShipToPartyStreet,
                    ShipToPartyCity: oFirstItem.ShipToPartyCity,
                    PayerParty: oFirstItem.PayerParty,
                    PayerPartyName: oFirstItem.PayerPartyName,
                    PayerPartyStreet: oFirstItem.PayerPartyStreet,
                    PayerPartyCity: oFirstItem.PayerPartyCity,
                    ShippingMethod: oFirstItem.ShippingMethod,
                    IncotermsLocation: oFirstItem.IncotermsLocation1,
                    PaymentTermsDesc: oFirstItem.PaymentTermsDesc,
                    PlannedGoodsIssueDate: oFirstItem.PlannedGoodsIssueDate,
                    TotalQuantity: oFirstItem.TotalQuantity,
                    TotalNetAmount: oFirstItem.TotalNetAmount,
                    Currency: oFirstItem.TransactionCurrency,
                }
                //删除行项目不需要的字段，节省内存
                aBillingItem.forEach(function(item, index){
                    item.No = index + 1;
                    delete item.BillingDocument;
                    delete item.CreationDate;
                    delete item.SoldToParty;
                    delete item.SoldToPartyName;
                    delete item.SoldToPartyStreet;
                    delete item.SoldToPartyCity;
                    delete item.ShipToParty;
                    delete item.ShipToPartyName;
                    delete item.ShipToPartyStreet;
                    delete item.ShipToPartyCity;
                    delete item.PayerParty;
                    delete item.PayerPartyName;
                    delete item.PayerPartyStreet;
                    delete item.PayerPartyCity;
                    delete item.ShippingMethod;
                    delete item.IncotermsLocation1;
                    delete item.CustomerPaymentTerms;
                    delete item.PlannedGoodsIssueDate;
                    delete item.TotalQuantity;
                    delete item.TotalNetAmount;


                });
                aBilling.push({
                    ...oHeader,
                    to_Items: {"results": aBillingItem }
                });
            });
            return aBilling;
        },
        porcessTHCotent: function(sDocTitle,aHeader,aContext){
            var aPrintItem = [];
            var aBilling = [];
            for (const boundContext of aContext) {
                var object = boundContext.getObject();
                aPrintItem.push(object);
            }
            var aPrintData = [];
            aHeader.forEach(function(sKey){
                let aBillingItem = aPrintItem.filter(e => e.BillingDocument === sKey );
                let oFirstItem = aBillingItem[0];
                let oHeader ={
                    CompanyName: oFirstItem.CompanyName,
                    CompanyAddress: oFirstItem.CompanyAddress,
                    CompanyTelFax: oFirstItem.CompanyTelFax,
                    DocTitle: sDocTitle,
                    BillingDocument: oFirstItem.BillingDocument,
                    CreationDate: oFirstItem.CreationDate,
                    SoldToParty: oFirstItem.SoldToParty,
                    SoldToPartyName: oFirstItem.SoldToPartyName,
                    SoldToPartyName1: oFirstItem.SoldToPartyName1,
                    SoldToPartyName2: oFirstItem.SoldToPartyName2,
                    SoldToPartyStreet: oFirstItem.SoldToPartyStreet,
                    SoldToPartyCity: oFirstItem.SoldToPartyCity,
                    SoldToPartyCountry: oFirstItem.SoldToPartyCountry,
                    ShipToParty: oFirstItem.ShipToParty,
                    ShipToPartyName: oFirstItem.ShipToPartyName,
                    ShipToPartyName1: oFirstItem.ShipToPartyName1,
                    ShipToPartyName2: oFirstItem.ShipToPartyName2,
                    ShipToPartyStreet: oFirstItem.ShipToPartyStreet,
                    ShipToPartyCity: oFirstItem.ShipToPartyCity,
                    ShipToPartyCountry: oFirstItem.ShipToPartyCountry,
                    ShipToPartyTel: oFirstItem.ShipToPartyTel,
                    ShipToPartyEmail: oFirstItem.ShipToPartyEmail,
                    ShipToPartyCountry: oFirstItem.ShipToPartyCountry,
                    PayerParty: oFirstItem.PayerParty,
                    PayerPartyName: oFirstItem.PayerPartyName,
                    PayerPartyName1: oFirstItem.PayerPartyName1,
                    PayerPartyName2: oFirstItem.PayerPartyName2,
                    PayerPartyStreet: oFirstItem.PayerPartyStreet,
                    PayerPartyCity: oFirstItem.PayerPartyCity,
                    PayerPartyCountry: oFirstItem.PayerPartyCountry,
                    ShippingMethod: oFirstItem.ShippingMethod,
                    IncotermsLocation: oFirstItem.IncotermsLocation1,
                    PaymentTermsDesc: oFirstItem.PaymentTermsDesc,
                    PlannedGoodsIssueDate: oFirstItem.PlannedGoodsIssueDate,
                    TotalQuantity:oFirstItem.TotalQuantity,
                    TotalNetAmount:oFirstItem.TotalNetAmount,
                    TaxRate:oFirstItem.TaxRate,
                    TaxAmount:oFirstItem.TaxAmount,
                    GrandTotalAmount:oFirstItem.GrandTotalAmount,
                    Currency: oFirstItem.TransactionCurrency,
                }
                //删除行项目不需要的字段，节省内存
                aBillingItem.forEach(function(item, index){
                    item.No = index + 1;
                    delete item.DocTitle;
                    delete item.BillingDocument;
                    delete item.BillingDocumentItem;
                    delete item.CompanyName;
                    delete item.CompanyAddress;
                    delete item.CompanyTelFax;
                    delete item.CreationDate;
                    delete item.SoldToParty;
                    delete item.SoldToPartyName;
                    delete item.SoldToPartyStreet;
                    delete item.SoldToPartyCity;
                    delete item.ShipToParty;
                    delete item.ShipToPartyName;
                    delete item.ShipToPartyStreet;
                    delete item.ShipToPartyCity;
                    delete item.PayerParty;
                    delete item.PayerPartyName;
                    delete item.PayerPartyStreet;
                    delete item.PayerPartyCity;
                    delete item.ShippingMethod;
                    delete item.IncotermsLocation1;
                    delete item.CustomerPaymentTerms;
                    delete item.PlannedGoodsIssueDate;
                    delete item.TotalQuantity;
                    delete item.TotalNetAmount;
                    delete item.TaxRate;
                    delete item.TaxAmount;
                    delete item.GrandTotalAmount;
                });
                //要求即使行数不够也要用空白行填满一页。目前一页可以打印12行，所以添加空白行，将行项目数量改为12的倍数
                let iMod = aBillingItem.length % 12;
                if (iMod !== 0) {
                    for (let i = 0; i < 12 - iMod; i++) {
                        aBillingItem.push({});
                    }
                }
                aBilling.push({
                    ...oHeader,
                    to_Items: {"results": aBillingItem }
                });
            });
            return aBilling;
        },
        porcessVNCDContent: function(sPrintType,aHeader,aContext,sPrintDate){
            var aPrintItem = [];
            var aBilling = [];
            for (const boundContext of aContext) {
                var object = boundContext.getObject();
                aPrintItem.push(object);
            }
            let sDocTitle
            switch(sPrintType) {
                case "1":
                    sDocTitle = "DEBIT NOTE"; break;
                case "2":
                    sDocTitle = "CREDIT NOTE"; break;
            }
            var aPrintData = [];
            aHeader.forEach(function(sKey){
                let aBillingItem = aPrintItem.filter(e => e.BillingDocument === sKey );
                let oFirstItem = aBillingItem[0];
                let sLongTextTX16;
                switch(sPrintType) {
                    case "1":
                        sLongTextTX16 = oFirstItem.LongTextTX16; break;
                    case "2":
                        sLongTextTX16 = "Balance SAP only"; break;
                }
                let oHeader ={
                    CompanyName: oFirstItem.CompanyName,
                    CompanyAddress: oFirstItem.CompanyAddress,
                    CompanyTelFax: oFirstItem.CompanyTelFax,
                    DocTitle: sDocTitle,
                    BillingDocument: oFirstItem.BillingDocument,
                    SoldToParty: oFirstItem.SoldToParty,
                    SoldToPartyName: oFirstItem.SoldToPartyName,
                    SoldToPartyStreet: oFirstItem.SoldToPartyStreet,
                    SoldToPartyCity: oFirstItem.SoldToPartyCity,
                    IssuedDate: sPrintDate,
                    LongTextTX02:oFirstItem.LongTextTX02,
                    LongTextTX16:sLongTextTX16,
                    TelephoneNumber1:oFirstItem.TelephoneNumber1,
                    TotalNetAmount:oFirstItem.TotalNetAmount,
                    Currency: oFirstItem.TransactionCurrency,
                }
                //删除行项目不需要的字段，节省内存
                aBillingItem.forEach(function(item, index){
                    item.No = index + 1;
                    delete item.DocTitle;
                    delete item.BillingDocument;
                    delete item.BillingDocumentItem;
                    delete item.CompanyName;
                    delete item.CompanyAddress;
                    delete item.CompanyTelFax;
                    delete item.SoldToParty;
                    delete item.SoldToPartyName;
                    delete item.SoldToPartyStreet;
                    delete item.SoldToPartyCity;
                    delete item.IssueDate;
                    delete item.TotalNetAmount;
                });
                aBilling.push({
                    ...oHeader,
                    to_Items: {"results": aBillingItem }
                });
            });
            return aBilling;
        },

        getPDF: function (pdfContent,sTemplateID) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = _ResourceBundle.getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = _oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTemplateID);
                createPrintRecord.setParameter("IsExternalProvidedData", true);
                var oXMLData = json2xml(pdfContent, {
                    compact: true,
                    ignoreComment: true,
                    spaces: 4
                });
                // var pdfData =  btoa(unescape(encodeURIComponent(oXMLData)));
                var pdfData = btoa(unescape(encodeURIComponent("<?xml version=\"1.0\" encoding=\"UTF-8\"?><form>" + oXMLData + "</form>")));
                createPrintRecord.setParameter("ExternalProvidedData", pdfData);
                // var uuidx16 = context.getObject().Uuid.replace(/-/g, '');
                createPrintRecord.setParameter("ProvidedKeys", "");
                createPrintRecord.setParameter("ResultIsActiveEntity", true);
                createPrintRecord.setParameter("FileName", sFileName);
                createPrintRecord.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(createPrintRecord);
                }).catch((oError) => {
                    reject(oError);
                });
            });
            aRecordCreated.push(promise);

            oBusyDialog.open();
            try {
                Promise.all(aRecordCreated).then((aContext) => {
                    oBusyDialog.close();
                    var sURL;
                    for (const activeContext of aContext) {
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        var sPath = _oPrintModel.getKeyPredicate("/PrintRecord", object);
                        sURL = activeContext.getModel("Print").getServiceUrl() + "PrintRecord" + sPath + '/PDFContent';
                        sap.m.URLHelper.redirect(sURL, true);
                    }
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });;
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            }
        },

        checkInconsistencies: function (aExcelSet) {
            let isInconsistencies = false;
            // 如果数组为空或只有一个对象，直接返回一致
            if (aExcelSet.length <= 1) return false;

            // 取第一个对象的这几个属性作为比较基准
            const { SoldToParty, ShippingPoint } = aExcelSet[0];

            // 遍历数组，检查每个对象的这几个属性是否与基准一致
            for (let i = 1; i < aExcelSet.length; i++) {
                const obj = aExcelSet[i];
                if (
                    obj.SoldToParty !== SoldToParty ||
                    obj.ShippingPoint !== ShippingPoint
                ) {
                    // aExcelSet[i].Type = "E";
                    // aExcelSet[i].Message = this._ResourceBundle.getText("msgDuplicate");
                    isInconsistencies = true; // 发现不一致，返回 true
                }
            }
            return isInconsistencies; // 所有对象都一致，返回 false
        },

        onDialogPress: function (oRouting, that, sAction) {
            if (!this.Dialog) {
                var oView = oRouting.getView();
                if (!this.Dialog) {
                    this.Dialog = Fragment.load({
                        id: oView.getId(),
                        name: "sd.invoiceprint.ext.fragment.Dialog",
                        controller: that
                    }).then(function (oDialog) {
                        return oDialog;
                    }.bind(this));
                }
            }
            this.Dialog.then(function (oDialog) {
                oRouting.getView().addDependent(oDialog);
                oDialog.setBeginButton(new sap.m.Button({
                    text: "{i18n>bConfirm}",
                    press: function () {
                        var sPrintDate = oRouting.getView().byId("idPrintDate").getValue();
                        if (sPrintDate === '') {
                            const currentDate = new Date();
                            sPrintDate = currentDate.toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            }).replace(/\//g, '/'); // 将年月日间的分隔符改为"/"
                        }
                        // 获取选择的行项目
                        if (that.getSelectedContexts) {
                            var aSelectedContexts = that.getSelectedContexts();
                        }
                        // ADD BEGIN BY XINLEI XU 2025/01/14
                        var sCreator = ""; // oRouting.getView().byId("idCreator").getValue();
                        var sApprover = ""; // oRouting.getView().byId("idApprover").getValue();
                        // ADD END BY XINLEI XU 2025/01/14
                        _oFunctions.onCustomAction(aSelectedContexts, sAction, sPrintDate, sCreator, sApprover);
                        oDialog.close();
                    }
                }));
                oDialog.setEndButton(new sap.m.Button({
                    text: "{i18n>bCancel}",
                    press: function () {
                        oDialog.close();
                    }
                }));
                oDialog.open();
            }.bind(this));
        }
    };
});
