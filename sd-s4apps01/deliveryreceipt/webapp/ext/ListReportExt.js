sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/BusyDialog",
    "./messages",
    "../lib/xml-js",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function(MessageToast, BusyDialog, messages, xml, Filter, FilterOperator) {
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
            // sEmail = "xinlei.xu@sh.shin-china.com"
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "deliveryreceipt-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "deliveryreceipt-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "deliveryreceipt-Print"),
                        Reprint: aAllAccessBtns.some(btn => btn.AccessId === "deliveryreceipt-Reprint"),
                        Clear: aAllAccessBtns.some(btn => btn.AccessId === "deliveryreceipt-Clear")
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
        onPrintDeliveryNote: function(oEvent) {
            var oBusyDialog = new BusyDialog();
             _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();

            _oDataModel = this.getModel();
            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            let aDeliveryDocument = aSelectedContexts.map(item => item.getObject()?.DeliveryDocument);
            aDeliveryDocument = Array.from(new Set(aDeliveryDocument))

            var aFilters = [];
            var aNewFilter = [];
            aDeliveryDocument.forEach(function(item){
                aNewFilter.push(new Filter({
                    path: "DeliveryDocument",
                    operator: FilterOperator.EQ,
                    value1: item
                }));
            });
            
            let oNewFilter = new Filter({
				filters:aNewFilter,
				and:false
			});
            aFilters.push(oNewFilter);

            var oContextBinding = _oDataModel.bindList("/DeliveryNote", undefined, undefined, aFilters, {});
            
            //获取行项目数据
            var aPrintItem = [];
            var oItemPromise =  oContextBinding.requestContexts();
            oItemPromise.then(function(aContext){
               let aPDFContent = _oFunctions.porcessDeliveryCotent(aDeliveryDocument,aContext);
               aPDFContent.forEach(pdfContent => {
                   _oFunctions.getPDF({"PrintData":pdfContent},"YY1_SD041");
               });
            });
        },

        porcessDeliveryCotent: function(aHeader,aContext){
            var aPrintItem = [];
            var aDelivery = [];
            for (const boundContext of aContext) {
                var object = boundContext.getObject();
                aPrintItem.push(object);
            }
            var aPrintData = [];
            aHeader.forEach(function(sDeliveryDocument){
                let aDeliveryItem = aPrintItem.filter(e => e.DeliveryDocument === sDeliveryDocument );
                let oFirstItem = aDeliveryItem[0];
                let oHeader ={
                    CompanyName: oFirstItem.CompanyName,
                    CompanyAddress: oFirstItem.CompanyAddress,
                    Companycontacts: oFirstItem.Companycontacts,
                    BarCode: oFirstItem.BarCode,
                    DeliveryDocument: oFirstItem.DeliveryDocument,
                    BillingDocument: oFirstItem.BillingDocument,
                    IssueDate: oFirstItem.IssueDate,
                    ShippingType: oFirstItem.ShippingType,
                    CustomerName: oFirstItem.CustomerName,
                    Incotern: oFirstItem.Incotern,
                    OrderQuantityTotal: oFirstItem.OrderQuantityTotal,
                    NetAmountTotal: oFirstItem.NetAmountTotal,
                    TaxRate: oFirstItem.TaxRate,
                    TaxAmount: oFirstItem.TaxAmount,
                    GrandTotalAmount: oFirstItem.GrandTotalAmount,
                    Currency: oFirstItem.TransactionCurrency
                }
                //删除行项目不需要的字段，节省内存
                aDeliveryItem.forEach(function(item){
                    delete item.CompanyName;
                    delete item.CompanyAddress;
                    delete item.Companycontacts;
                    delete item.DeliveryDocument;
                    delete item.BillingDocument;
                    delete item.IssueDate;
                    delete item.ShippingType;
                    delete item.CustomerName;
                    delete item.Incotern;
                    delete item.OrderQuantityTotal;
                    delete item.NetAmountTotal;
                    delete item.TaxRate;
                    delete item.TaxAmount;
                    delete item.GrandTotalAmount;
                });
                aDelivery.push({
                    ...oHeader,
                    to_Items: {"results": aDeliveryItem }
                });
            });
            // return {"PrintData":aDelivery};
            return aDelivery;
        },
        // 印刷和订正印刷， 订正印刷取当前选定的值，印刷需要按打印维度key取自建表已经存储的上次打印的条目的
        onPrint: function(oEvent) {
            _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();

            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            _oFunctions.onCustomAction(aSelectedContexts,"printDeliveryReceiptNo");
        },

        onReprint: function () {
            _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();

            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            _oFunctions.onCustomAction(aSelectedContexts,"reprintDeliveryReceiptNo");
        },

        onDelete: function () {
            _oDataModel = this.getModel();
            _oPrintModel = this.getModel("Print");
            _ResourceBundle = this.getModel("i18n").getResourceBundle();

            // 获取选择的行项目
            if (this.getSelectedContexts) {
                var aSelectedContexts = this.getSelectedContexts();
            }
            _oFunctions.onCustomAction(aSelectedContexts,"deleteDeliveryReceiptNo");
        },

        onCustomAction: function (aSelectedContexts,sActionName) {
            var aSelectedItem = [];
            var aPromise = [];
            var aItems = [];
            aSelectedContexts.forEach( function (item) {
                var itemObject = item.getObject();
                aSelectedItem.push(item.getObject());
                aItems.push({
                    DeliveryDocument: itemObject.DeliveryDocument,
                    DeliveryDocumentItem: itemObject.DeliveryDocumentItem,
                });
            } );
            if(_oFunctions.checkInconsistencies(aSelectedItem)) {
                messages.showError(_ResourceBundle.getText("msgInconsistencies"));
                return;
            }

            aPromise.push(_oFunctions.printAction(aItems,sActionName));

            Promise.all(aPromise).then(function (records) {
                records.forEach(record => {
                    if (sActionName !== "deleteDeliveryReceiptNo" ) {
                        var pdfContent = _oFunctions.porcessPrintContent(record);
                        _oFunctions.getPDF(pdfContent,"YY1_SD018");
                    } else {
                        messages.showSuccess(_ResourceBundle.getText("msgDeleteSuccessed"));
                    }
                });
            });
        },

        printAction: function (items,sActionName) {
            var promise = new Promise(function (resolve,reject) {
                var oAction = _oDataModel.bindContext("/DeliveryReceipt/com.sap.gateway.srvd.zui_deliveryreceipt_o4.v0001." + sActionName + "(...)");
                oAction.setParameter("Zzkey", JSON.stringify(items));
                oAction.setParameter("Event","");
                oAction.setParameter("RecordUUID","");
                
                oAction.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(( ) => {
                    try {
                        var records = oAction.getBoundContext().getObject().value; //获取返回的数据
                    } catch (e) {}
                    resolve(records);
                    
                }).catch((oError) => {
                    messages.showError(oError.message);
                    reject(oError);
                });
            });
            return promise;
        },

        porcessPrintContent: function (aSelectedItem) {
            // 检查选择的数据打印的维度是否一致，如果不一致则报错
            if (this.checkInconsistencies(aSelectedItem)) {
                messages.showError(_ResourceBundle.getText("msgInconsistencies"));
                return;
            }

            var pdfContent = {
                PrintData:{
                    results: []
                }
            };
            // 纳品书抬头
            var _DELIVERYITEM = {
                DELIVERYRECEIPTNO: aSelectedItem[0].DeliveryReceiptNo,
                SHIPTOPARTY: aSelectedItem[0].ShipToParty,
                POSTALCODE: aSelectedItem[0].PostalCode,
                CITYNAME: aSelectedItem[0].CityName,
                CUSTOMERNAME: aSelectedItem[0].CustomerName,
                DeliveryItem: {results:[]}
            };
            //受领书抬头
            var _RECEIPTITEM = {
                DELIVERYRECEIPTNO: aSelectedItem[0].DeliveryReceiptNo,
                SHIPTOPARTY: aSelectedItem[0].ShipToParty,
                POSTALCODE: aSelectedItem[0].PostalCode,
                CITYNAME: aSelectedItem[0].CityName,
                CUSTOMERNAME: aSelectedItem[0].CustomerName,
                ReceiptItem: {results:[]}
            };

            aSelectedItem.forEach(function(item, index) {
                // 纳品书
                _DELIVERYITEM.DeliveryItem.results.push({
                    REFERENCESDDOCUMENT: item.ReferenceSDDocument,
                    MATERIALBYCUSTOMER: item.MaterialByCustomer || item.Material,
                    DELIVERYDOCUMENTITEMTEXT: item.DeliveryDocumentItemText,
                    ACTUALDELIVERYQUANTITY: item.ActualDeliveryQuantity,
                    DELIVERYQUANTITYUNIT: item.DeliveryQuantityUnit,
                    CONDITIONRATEVALUE: item.ConditionRateValue,
                    CONDITIONAMOUNT: item.ConditionAmount,
                });
                //受领书
                _RECEIPTITEM.ReceiptItem.results.push({
                    REFERENCESDDOCUMENT: item.ReferenceSDDocument,
                    MATERIALBYCUSTOMER: item.MaterialByCustomer || item.Material,
                    DELIVERYDOCUMENTITEMTEXT: item.DeliveryDocumentItemText,
                    ACTUALDELIVERYQUANTITY: item.ActualDeliveryQuantity,
                    DELIVERYQUANTITYUNIT: item.DeliveryQuantityUnit
                });
                // pdf每页固定显示5行，在pdf中不好控制，所以在此处将数据分页
                if ((index + 1) % 5 === 0 || index + 1 === aSelectedItem.length ) {
                    pdfContent.PrintData.results.push({
                        _DELIVERYITEM: JSON.parse(JSON.stringify(_DELIVERYITEM)),
                        _RECEIPTITEM: JSON.parse(JSON.stringify(_RECEIPTITEM)),
                    });
                    _DELIVERYITEM.DeliveryItem = {results:[]};
                    _RECEIPTITEM.ReceiptItem = {results:[]};
                }
            });

            return pdfContent;
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
                    // aExcelSet[i].Message = _ResourceBundle.getText("msgInconsistencies");
                    
                    isInconsistencies = true; // 发现不一致，返回 true
                }
            }

        
            return isInconsistencies; // 所有对象都一致，返回 false
        },
    };
});
