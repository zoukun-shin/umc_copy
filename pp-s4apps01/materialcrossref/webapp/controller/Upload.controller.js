sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "./messages",
    "../util/xlsx",
    "sap/m/BusyDialog",
    "sap/ui/export/Spreadsheet"
], function (
    BaseController, formatter, messages, xlsx, BusyDialog, Spreadsheet
) {
    "use strict";

    return BaseController.extend("pp.materialcrossref.controller.Upload", {
        formatter: formatter,
        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_MATERIALCROSSREF");
            var oControlBinding = this.byId("idUploadSet").getBinding("items");
            oControlBinding.filter(oFilter);
        },

        getMediaUrl: function (sUrlString) {
            if (sUrlString) {
                var sUrl = new URL(sUrlString);
                var iStart = sUrl.href.indexOf(sUrl.origin);
                var sPath = sUrl.href.substring(iStart + sUrl.origin.length, sUrl.href.length);
                //return "/S4" + sPath;
                return jQuery.sap.getModulePath("mm.uploadpurchasereq") + sPath;
            } else {
                return "";
            }
        },

        onFileUploaderChange: function (oEvent) {
            /*global XLSX*/
            this._LocalData.setProperty("/logInfo", "");
            // var oFile = oEvent.getSource().getFocusDomRef().files[0];
            var oFile = oEvent.getParameter("files")[0];
            //如果在文件命中匹配到对应的字符串则认为是对应模板
            // if (oFile.name.indexOf("差異まとめ") >= 0) { }

            if (!oFile) {
                this._LocalData.setProperty("/excelSet", []);
                return;
            }

            var aExcelSet = [];
            var oItem = {};
            var aHeadSet = [];
            var aItemSet = [];
            var dataKey;
            var oReader = new FileReader();
            oReader.readAsArrayBuffer(oFile); // 将文件读取为数组格式的数据
            oReader.onload = function (e) {
                this.isEnable = true;
                this._BusyDialog.open();
                // this.byId(this.sSaveButtonId).setEnabled(false);
                // 获取excel内容，此时是乱码
                var sResult = e.target.result;
                // 解码excel内容
                var oWB = XLSX.read(sResult, {
                    type: "binary",
                    cellDates: true,
                    dateNF: 'yyyy/mm/dd;@'
                });
                // 获取sheet1单元格的内容
                var oSheet1 = oWB.Sheets[oWB.SheetNames[0]];
                // 将单元格的内容转换成数组的形式（自动将第一行作为抬头）
                var aSheet1 = XLSX.utils.sheet_to_row_object_array(oSheet1, { raw: false });
                // for循环每一行的内容添加到数据集当中,数据从第excel的3行开始（第一行默认为技术字段，不读取，第二行为说明行，JS中从0开始，所以从1开始读）
                for (var i = 6; i < aSheet1.length; i++) {
                    oItem = {
                        Type: "",
                        Message: "",
                        Row: i,
                        Plant: aSheet1[i]["Plant"] || "",
                        DeliveryMaterial: aSheet1[i]["DeliveryMaterial"] || "",
                        ReceiptMaterial: aSheet1[i]["ReceiptMaterial"] || "",
                        PurchaseOrder: aSheet1[i]["PurchaseOrder"] || "",
                        PurchaseOrderItem: aSheet1[i]["PurchaseOrderItem"] || "",
                        DelFlag: aSheet1[i]["DelFlag"] || "",
                    };
                    aExcelSet.push(oItem);
                }

                //权限校验
                if (this._LocalData.getProperty("/authorityCheck/button/Check")) {
     
                    this.byId("idCheckButton").setEnabled(true);

                } else {
                    this.byId("idCheckButton").setEnabled(false);
                }
                this._LocalData.setProperty("/excelSet", aExcelSet)
                this._BusyDialog.close();
                this._LocalData.setProperty("/recordCheckSuccessed", false);
            }.bind(this);
        },

        getErrorCount: function (aExcelSet, sAction) {
            var iTotal = 0,
                iError = 0,
                iSuccess = 0;
            iTotal = aExcelSet.length;
            aExcelSet.forEach(function (value) {
                if (value.Type === "E") {
                    iError++;
                } else {
                    iSuccess++;
                }
            });
            var sLogInfo = this._ResourceBundle.getText("logInfo", [iTotal, iSuccess, iError]);
            this._LocalData.setProperty("/logInfo", sLogInfo);
            if (iError > 0) {
                return;
            }
            switch (sAction) {
                case "check":
                    this._LocalData.setProperty("/recordCheckSuccessed", true);
                    break;
                case "excute":
                    this._LocalData.setProperty("/recordCheckSuccessed", false);
                    break;
            }
        },

        onButtonPress: function (oEvent, sAction) {
            let postDocs = this.preparePostBatchBody();
            for (var i = 0; i < postDocs.length; i++) {
                this.postAction(sAction, postDocs[i], i);
            }
        },

        preparePostBatchBody: function () {
            let aExcelSet = this._LocalData.getProperty("/excelSet");
            let copyExcelSet = [];
            var hasError = aExcelSet.find(element => element.Type === "E");
            if (hasError) {
                messages.showError(this._ResourceBundle.getText("hasError"));
                return;
            }
            aExcelSet.forEach(item => {
                let postDoc = JSON.parse(JSON.stringify(item));
                postDoc.Type = "";
                postDoc.Message = "";
                copyExcelSet.push(postDoc);
            }, this)
            let postDocs = [JSON.stringify(copyExcelSet)];
            return postDocs;
        },

        postAction: function (sAction, postData, i) {
            var oModel = this._oDataModel;
            oModel.callFunction("/processLogic", {
                method: "POST",
                changeSetId: i,
                urlParameters: {
                    Event: sAction,
                    Zzkey: postData
                },
                success: function (oData) {
                    let aExcelSet = this._LocalData.getProperty("/excelSet");
                    let result = JSON.parse(oData["processLogic"].Zzkey);
                    result.forEach(function (line) {
                        for (let i = 0; i < aExcelSet.length; i++) {
                            if (aExcelSet[i].Row == line.ROW) {
                                Object.keys(aExcelSet[0]).forEach(function (key) {
                                    if (key !== "Row") {
                                        aExcelSet[i][key] = line[key.toUpperCase()];
                                        aExcelSet[i].Type = line.STATUS;
                                    }
                                });
                            }
                        }
                    });
                    this._LocalData.setProperty("/excelSet", aExcelSet);
                    this.getErrorCount(aExcelSet, sAction);
                }.bind(this),
                error: function (oError) {
                    this._LocalData.setProperty("/recordCheckSuccessed", false);
                    messages.showError(messages.parseErrors(oError));
                }.bind(this)
            });
        },

        onExport: function (oEvent) {
            // 根据id值获取table 
            var oTable = this.getView().byId("idTable");
            // 获取table的绑定路径
            var sPath = oTable.getBindingPath("rows");
            // 获取table数据
            var aExcelSet = this._LocalData.getProperty(sPath);

            var aExcelCol = [];
            // 获取table的columns
            var aTableCol = oTable.getColumns();
            for (var i = 1; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var oExcelCol = {
                        // 获取表格的列名，即设置excel的抬头
                        label: sLabelText,
                        // 数据类型，即设置excel该列的数据类型
                        type: "string",
                        // 获取数据的绑定路径，即设置excel该列的字段路径
                        property: aTableCol[i].getAggregation("template").getBindingPath("text"),
                        // 获取表格的width属性，即设置excel该列的长度
                        width: parseFloat(aTableCol[i].getWidth())
                    };
                    aExcelCol.push(oExcelCol);
                }
            }
            // 设置excel的相关属性
            var oSettings = {
                workbook: {
                    columns: aExcelCol,
                    context: {
                        version: "1.54",
                        hierarchyLevel: "level"
                    }
                },
                dataSource: aExcelSet, // 传入参数，数据源
                fileName: "Export_" + this._ResourceBundle.getText("title") + new Date().getTime() + ".xlsx" // 文件名，需要加上后缀
            };
            // 导出excel
            new Spreadsheet(oSettings).build();
        },
    });
});