sap.ui.define([
    "./BaseController",
    "sap/m/BusyDialog",
    "../model/formatter",
    "../lib/xlsx",
    "sap/ui/export/Spreadsheet",
    "./messages",
], (BaseController,BusyDialog,formatter,xlsx,Spreadsheet,messages) => {
    "use strict";

    return BaseController.extend("mm.masspostofscrap.controller.Main", {
        formatter: formatter,
        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();


            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },
        _initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_MPOS_" + sLanguage);
            var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
            oControlBinding.filter(oFilter);

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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "masspostofscrap-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "masspostofscrap-View"),
                        Upload: aAllAccessBtns.some(btn => btn.AccessId === "masspostofscrap-Upload"),
                        Chcek: aAllAccessBtns.some(btn => btn.AccessId === "masspostofscrap-Chcek"),
                        Execute: aAllAccessBtns.some(btn => btn.AccessId === "masspostofscrap-Execute"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "masspostofscrap-Export"),
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
                            text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },
        onFileUploaderChange: function (oEvent) {
            var that = this;
            /*global XLSX*/
            this._LocalData.setProperty("/logInfo", "");
            this._LocalData.setProperty("/recordCheckSuccessed", false);
            var oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                this._LocalData.setProperty("/excelSet", []);
                return;
            }

            var oReader = new FileReader();
            oReader.readAsArrayBuffer(oFile); 
            oReader.onload = function (e) {
                this.isEnable = true;
                var sResult = e.target.result;
                var oWB = XLSX.read(sResult, {
                    type: "binary",
                    cellDates: true,
                    dateNF: 'yyyy/mm/dd;@',
                });
                var oSheet1 = oWB.Sheets[oWB.SheetNames[0]];
                var aSheet1 = XLSX.utils.sheet_to_row_object_array(oSheet1,{raw:false});
                //// 将单元格的内容转换成数组的形式,从第一行开始读取，将列的字母序号作为属性名称
                //var aSheet1 = XLSX.utils.sheet_to_row_object_array(oSheet1, { header: "A", raw: false });
                this.readSheet(aSheet1);

            }.bind(this);
        },
        readSheet: function (aSheet1) {
            let aExcelSet = [];
            let oItem;
            for (var i = 4; i < aSheet1.length; i++) {
                oItem = {
                    Type: "",
                    Message: "",
                    Tabix: i,
                    Plant: aSheet1[i]["Plant"] || "",
                    MovementType: aSheet1[i]["GoodsMovementType"] || "",
                    Material: aSheet1[i]["Material"] || "",
                    ScrapQuantity: aSheet1[i]["EntryUnit"] || "0",
                    Unit: aSheet1[i]["QuantityInBaseUnit"] || "",
                    StorageLocation: aSheet1[i]["StorageLocation"] || "",
                    // GLAccount: aSheet1[i]["GLAccount"] || "",
                    HeaderText: aSheet1[i]["MaterialDocumentHeaderText"] || "",
                    ReasonCode: aSheet1[i]["GoodsMovementReasonCode"] || "",
                    MatDocItemText: aSheet1[i]["MaterialDocumentItemText"] || "",

                }
                aExcelSet.push(oItem);
            }
            if (aExcelSet.length === 0) {
                return;
            }
            // this.getErrorCount(aExcelSet,"check");
            this._LocalData.setProperty("/excelSet", aExcelSet);
        },

        onCheck: function (oEvent) { 
            this.checkRequired();
        },

        onExcute: function (oEvent) {
            let aMass = this.preparePostBody();
            this.postAction("processJSONData", JSON.stringify(aMass));
        },

        preparePostBody: function () {
            let aExcelSet = this._LocalData.getProperty("/excelSet");
            return aExcelSet;
        },

        postAction: function (sAction, postData) {
			this._BusyDialog.open();
            var aExcelSet = this._LocalData.getProperty("/excelSet");
			var oModel = this._oDataModel;
			oModel.callFunction(`/${sAction}`, {
				method: "POST",
				// groupId: "myId",//如果设置groupid，会多条一起进入action
				changeSetId: 1,
				//建议只传输前端修改的参数，其他字段从后端获取
				urlParameters: {
					Event: sAction,
					JsonData: postData
				},
				success: function (oData) {
                    let object = JSON.parse(oData[sAction].JsonData);

					// 更新message
                    object.forEach(function(line){
                        // let searchKey = `${line.PLANT}_${line.MATERIAL}`;
                        let searchKey = `${line.TABIX}`;
                        let item = aExcelSet.find(item => {
                            const key = `${item.Tabix}`;
                            return key === searchKey;
                        });
                        if (item) {
                            item.Type = line.TYPE;
                            item.Message = line.MESSAGE;
                        }
                    });
                    this._LocalData.setProperty("/excelSet", aExcelSet);
					this._BusyDialog.close();
				}.bind(this),
				error: function (oError) {
					// if (sAction !== "deletePR") { // ADD BY XINLEI XU 2025/04/22 CR#4359
					// 	this._LocalData.setProperty("/recordCheckSuccessed", false);
					// }
					messages.showError(messages.parseErrors(oError));
					this._BusyDialog.close();
				}.bind(this)
			});
			// oModel.submitChanges({ groupId: "myId" });
		},

        checkRequired: function () {
            let aExcelSet = this._LocalData.getProperty("/excelSet");
            let isExistError = false;
            let aRequiredFields = ["Plant","MovementType","Material","ScrapQuantity","StorageLocation"];
            let sMsg = this._ResourceBundle.getText("msg02");
            for (let i = 0; i < aExcelSet.length; i++) {
                let oItem = aExcelSet[i];
                oItem.Type = "S"; 
                oItem.Message = sMsg;
                for (let field of aRequiredFields) {
                    if (!oItem[field]) {
                        oItem.Type = "E";
                        oItem.Message = this._ResourceBundle.getText("msg01");
                        isExistError = true;
                    }
                }
            }
            // if (isExistError) {
            //     this._LocalData.setProperty("/recordCheckSuccessed", false);
            // } else {
            //     this._LocalData.setProperty("/recordCheckSuccessed", true);
            // }
            this.getErrorCount(aExcelSet,"check");
        },
        onExport: function (oEvent) {
			var sId = oEvent.getSource().getParent().getParent().getId();
			// 根据id值获取table 
			var oTable = this.getView().byId(sId);
			// 获取table的绑定路径
			var sPath = oTable.getBindingPath("rows");
			// 获取table数据
			var aExcelSet = this._LocalData.getProperty(sPath);
			
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern: "yyyyMMdd"});
			var oTimeFormat = sap.ui.core.format.DateFormat.getTimeInstance({pattern: "HHmmss"});
			var sFileName = this._ResourceBundle.getText("title") + "_" + 
				oDateFormat.format(new Date()) + oTimeFormat.format(new Date());


			var aExcelCol = [];
			// 获取table的columns
			var aTableCol = oTable.getColumns();
            // 添加Type字段

            aExcelCol.push({
                label: this._ResourceBundle.getText("Type"),
                type: "string",
                property: "Type",
                width: 8
            });
			for (var i = 1; i < aTableCol.length; i++) {
				if (aTableCol[i].getVisible()) {
					var sLabelText = aTableCol[i].getAggregation("label").getText();
					var sProperty = aTableCol[i].getAggregation("template").getBindingPath("text");
					var sType = "string";
					// switch (sProperty) {
					// 	case "PrdStartDate":
					// 	case "PrdEndDate":
					// 		sType = "Date";
					// 		break;
					// }
					var oExcelCol = {
						// 获取表格的列名，即设置excel的抬头
						label: sLabelText,
						// 数据类型，即设置excel该列的数据类型
						type: sType,
						// 获取数据的绑定路径，即设置excel该列的字段路径
						property: sProperty,
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
						version: "${version}",
						hierarchyLevel: "level"
					}
				},
				dataSource: aExcelSet, // 传入参数，数据源
				fileName: sFileName // 文件名，需要加上后缀
			};
			// 导出excel
			new Spreadsheet(oSettings).build();
		},

        getErrorCount: function (aExcelSet,sAction) {
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
			var sLogInfo = this._ResourceBundle.getText("logInfo", [iTotal, iSuccess, iError]);//logInfo={0}件中、{1}件の取込に成功、{2}件の取込に失敗しました
			this._LocalData.setProperty("/logInfo", sLogInfo);
			// 可以根据是否错误控制一些按钮状态
			if (iError > 0) {
                    return;
                }
                switch (sAction) {
                    case "check":
                        this._LocalData.setProperty("/recordCheckSuccessed", true);
                        break;
                    case "save":
                        this._LocalData.setProperty("/recordCheckSuccessed", false);
                        break;
                }
		},

    });
});