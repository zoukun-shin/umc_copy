sap.ui.define([
    "./BaseController",
    "../model/formatter",
	"./messages",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/BusyDialog",
	"sap/ui/export/Spreadsheet"
], (BaseController,
    formatter,
	messages,
	Filter,
	MessageBox,
	BusyDialog,
	Spreadsheet) => {
    "use strict";

    return BaseController.extend("sd.printpackinglist.controller.Main", {
		formatter: formatter,
        onInit() {
			this._BusyDialog = new BusyDialog();
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this.aHttpRequest = [];
			this.dataFinished = true;
        },
		onSearch: function (oEvent) {
			this.errorPopup = false;
			var aFilter = this.getView().byId("idSmartFilterBar").getFilters();
			var oFilterData = this.getView().byId("idSmartFilterBar").getFilterData();
			var oNewFilter, aNewFilter = [];

			// 获取处理范围
			var oDateRange = this.byId("idDateRangeSelection");
			if ( this.vaildDate(oDateRange) ){
				return;
			}
			// 必输检查
			let sMessage = this.CheckRequiredFilter(oFilterData);
			if (sMessage){
				messages.showError(sMessage);
				return;
			}

			var oStartDate = oDateRange.getFrom();
			var oEndDate = oDateRange.getTo();
			
			if (oDateRange.getValue()) {
				// 如果未完整选择两个日期，则结束日期等于起始日期
				if (oStartDate && !oEndDate) {
					oEndDate = oStartDate;
				}
				aNewFilter.push(new Filter("CreationDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
			}

			oNewFilter = new Filter({
				filters: aNewFilter,
				and: true
			});
			if (aNewFilter.length > 0) {
				aFilter.push(oNewFilter);
			}
			if (!aFilter) {
				aFilter = [];
			}
			// this.getFilter(aFilter)
			//中止之前的请求,防止上次正在请求的数据请求完成后错误的添加到此次请求中
			this.aHttpRequest.forEach(function (req) {
				req.abort();
			});

			this.getEntityCount(aFilter).then(function (iItemCount) {
				if (iItemCount > 0) {
					//设置要查询的字段
					// let sParamtetrsOfSelect = "Customer,Plant,Material,MaterialByCustomer,MaterialName,ShippingPlanDate,Quantity";
					// let sParamtetrsOfSelect = "UUID,DataJson"; // MOD BY XINLEI XU 2025/02/27
					//获取数据
					this._LocalData.setProperty("/PackingList", []);
					this._LocalData.setProperty("/PackingListTemp", []);
					// this.getEntityContentOnePage(iItemCount, 0, aFilter, sParamtetrsOfSelect);
					this.getEntityContentOnePage(iItemCount, 0, aFilter, undefined);
				} else {
					this._LocalData.setProperty("/PackingList", []);
					this.byId("idDynamicPage").setBusy(false);
				}
			}.bind(this));
		},

		getEntityCount: function (aFilter) {
			var that = this;
			that.byId("idDynamicPage").setBusy(true);
			var promise = new Promise(function (resolve, reject) {
				var mParameters = {
					urlParameters:{FgOnly:'X'},
					filters: aFilter,
					success: function (oData, response) {
						//如果后端统计条目数时不是使用的最终数据内表统计，那么这里的iItemCount并不一定准确，实际条目可能会少一些
						var iItemCount = Number(oData);
						resolve(iItemCount);
					},
					error: function (oError) {
						var iItemCount = 0;
						resolve(iItemCount);
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
				that.getOwnerComponent().getModel().read("/PackingList/$count", mParameters);
			});
			return promise;
		},

		getEntityContentOnePage: function (iTop, iSkip, aFilter, sParamtetrsOfSelect) {
			sParamtetrsOfSelect = sParamtetrsOfSelect ? sParamtetrsOfSelect : "";
			var that = this;
			this.aHttpRequest = [];
			that.byId("idDynamicPage").setBusy(true);
			that.dataFinished = false;
			var aPromise = [];

			var aResult = that._LocalData.getProperty("/PackingList");
			var aResultTemp = that._LocalData.getProperty("/PackingListTemp");
			var promise = new Promise(function (resolve, reject) {
				var mParameters = {
					filters: aFilter,
					urlParameters: {
						"$top": iTop,// iTop等于总数 超过5000条abap cloud会自动分页
						"$skiptoken": iSkip,
						"$select": sParamtetrsOfSelect
					},
					success: function (oData) {
						if (oData.results.length > 0) {
							// // MOD BEGIN BY XINLEI XU 2025/02/27
							aResultTemp.push.apply(aResultTemp, oData.results);
							// oData.results.forEach(element => {
							// 	aResultTemp.push.apply(aResultTemp, JSON.parse(element.DataJson));
							// });
							// // MOD END BY XINLEI XU 2025/02/27
							that._LocalData.setProperty("/PackingList", aResultTemp);
						}
						resolve(oData);
					},
					error: function (oError) {
						//手动中止的导致的错误不需要处理
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
								that._LocalData.setProperty("/PackingList", []);
							}
							that.aHttpRequest.forEach(function (req) {
								req.abort();
							});
							reject();
						}
					}
				};
				that.getOwnerComponent().getModel().setUseBatch(false);
				that.aHttpRequest.push(that.getOwnerComponent().getModel().read("/PackingList", mParameters));
			});
			promise.then(function (oData) {
				// 如果存在next参数，说明数据还未取完，需要再次取值
				if (oData.__next) {
					//abap cloud中odata每次最多只能取5000条，所以当还有数据时 iSkip加5000即可
					// 但这里会存在效率问题，虽然服务器强制分页，但是后端处理数据的逻辑中并没有考虑分页，那么相当于整个取值逻辑要重复执行好几次
					// 且需要前一页执行完毕之后才处理第二页
					iSkip = iSkip + 5000;
					that.getEntityContentOnePage(iTop, iSkip, aFilter, sParamtetrsOfSelect);
					// 如果不存在next参数则说明数据已经取完
				} else {
					aResultTemp = that._LocalData.getProperty("/PackingListTemp");
					aResult = that.transformData(aResultTemp);
					that._LocalData.setProperty("/PackingList", aResult);

					that.aHttpRequest = [];
					that._LocalData.refresh();
					that.dataFinished = true;
					that.byId("idDynamicPage").setBusy(false);
				}
			});
			// aPromise.push(promise);
		},

		transformData: function (data) {
			// 创建一个对象来存储转换后的数据
			let result = {};

			return data.map(item => {
				delete item.__metadata;
				return item;
			});

		},

		onPrint: function() {
			let that = this;
			var aPromise = [];
			var aExcelSet = this.getModel("local").getProperty("/PackingList");
			// aPromise.push(this._callODataAction("EXPORT", aExcelSet)
			aPromise.push(this.postAction("processLogic", "EXPORT", aExcelSet));

			try {
				this._BusyDialog.open();
				Promise.all(aPromise).then((aContext) => {
                    var oResult = {
                        iSuccess: 0,
                        iFailed: 0
                    };
                    this._BusyDialog.close();
                    var aExcelSet = this.getModel("local").getProperty("/PackingList");
                    for (const activeContext of aContext) {
                        var object = activeContext.processLogic;
						if (object.RecordUUID) {
							var sURL = this.getModel("Print").getServiceUrl() + "PrintRecord(RecordUUID=" + object.RecordUUID + ",IsActiveEntity=true)/PDFContent";
							sap.m.URLHelper.redirect(sURL, true);
						}
                    }
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    that._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                that._BusyDialog.close();
            }
		},

		onSave: function() {
			let that = this;
			let aPromise = [];
			let aExcelSet = this.getModel("local").getProperty("/PackingList");
			aPromise.push(this.postAction("processLogic", "SAVE", aExcelSet));
			try {
				this._BusyDialog.open();
				Promise.all(aPromise).then((aContext) => {
                    var oResult = {
                        iSuccess: 0,
                        iFailed: 0
                    };
                    this._BusyDialog.close();
                    // var aExcelSet = this.getModel("local").getProperty("/PackingList");
                    // for (const activeContext of aContext) {
                    //     var object = activeContext.processLogic;
                    // }
					messages.showText("Save Successed");
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    that._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                that._BusyDialog.close();
            }
		},

		_callODataAction: function (bEvent, aRequestData) {
            return new Promise((resolve, reject) => {
                var uploadProcess = this.getModel().bindContext("/PackingList/com.sap.gateway.srvd.zui_bomupload_o4.v0001.processLogic(...)");
                uploadProcess.setParameter("Event", bEvent);
                uploadProcess.setParameter("Zzkey", JSON.stringify(aRequestData));
                uploadProcess.setParameter("RecordUUID", '');
                uploadProcess.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(uploadProcess);
                }).catch((error) => {
                    reject(error);
                });
            });
        },
		postAction: function (sAction, sEvent, postData) {
			let that = this;
			that._BusyDialog.open();
			let oModel = this._oDataModel;
			return new Promise((resolve,reject) => {
				oModel.callFunction(`/${sAction}`, {
					method: "POST",
					// groupId: "myId",//如果设置groupid，会多条一起进入action
					changeSetId: 1,
					//建议只传输前端修改的参数，其他字段从后端获取
					urlParameters: {
						Event: sEvent,
						Zzkey: JSON.stringify(postData)
					},
					success: function (oData) {
						resolve(oData);

					}.bind(this),
					error: function (oError) {
						reject(oError);
						messages.showError(messages.parseErrors(oError));
					}.bind(this)
				});
			});
		},


		vaildDate:function (oControl) {
			var bValid = oControl.isValidValue();
			if (bValid) {
				oControl.setValueState("None");
				return false;
			} else {
				oControl.setValueState("Error");
				return true;
			}
		},

		onNumberChange: function(oEvent) {
			let sNo = oEvent.getParameter("value");
			let aNo = sNo.split("-");
			let sEndSeq;
			if (aNo.length === 1) {
				sEndSeq = aNo[0];
			} else if (aNo.length > 1) {
				sEndSeq = aNo[1];
			}
			if (sEndSeq) {
				let iBoxEndSeq = Number(sEndSeq);
				let sPath = oEvent.getSource().getBindingContext("local").sPath;
				let sProperty = oEvent.getSource().getBindingPath("value");
				if (sProperty === "BoxNo") {
					this._LocalData.setProperty(sPath + "/BoxSeqEnd",iBoxEndSeq);
				} else if (sProperty === "PalletNo"){
					this._LocalData.setProperty(sPath + "/PalletSeqEnd",iBoxEndSeq);
				}
			}
		},

		CheckRequiredFilter:function(oFilterData) {
			if(this.byId("idCreatePackingListCB").getSelected()) {
				// ShippingPoint 必输
				if (!oFilterData["ShippingPoint"]) {
					return this._ResourceBundle.getText("msg01");
				}

				var oDateRange = this.byId("idDateRangeSelection");
				// BillingDocument 和 CreationDate 至少输入一个
				if (!oFilterData["BillingDocument"] && !oDateRange.getValue()) {
					return this._ResourceBundle.getText("msg02");
				}
				// 并且 CreationDate 范围不能超过两周
				if (!this.checkDateRange(oDateRange)) {
					return this._ResourceBundle.getText("msg03");
				}
			} else {
				if (!oFilterData["BillingDocument"]) {
					return this._ResourceBundle.getText("msg04");
				}
			}

		},

		checkDateRange: function(oControl) {
			var oStartDate = oControl.getFrom();
			var oEndDate = oControl.getTo();
			// 如果未完整选择两个日期，则退出
			if (!oStartDate || !oEndDate) {
				return true;
			}

			// 调用核心算法，计算最大允许的截止日期
			var oMaxEndDate = this._calculateMaxEndDate(oStartDate);
			
			// 比较用户选择的截止日期是否超过了最大允许日期
			if (oEndDate.getTime() > oMaxEndDate.getTime()) {
				// // 1.给出错误提示
				// sap.m.MessageToast.show(this._ResourceBundle.getText("msg03"), {
				// 	duration: 3000
				// });
				// 2. 可选：自动将截止日期修正为最大允许值
				// oControl.setDateValue([oStartDate, oMaxEndDate]);
				
				// 3. 或者：清空选择，让用户重选（更清晰的交互）
				oControl.setValue("");
				oControl.setDateValue(null);
				oControl.focus();
				return false;
			}
			return true;
		},
		_calculateMaxEndDate: function(oStartDate) {
			// 创建一个起始日期的副本，避免修改原对象
			var oMaxEndDate = new Date(oStartDate.getTime());
			// 不允许超过两周
			oMaxEndDate.setDate(oMaxEndDate.getDate() + 13);
			return oMaxEndDate;
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
			for (var i = 1; i < aTableCol.length; i++) {
				if (aTableCol[i].getVisible()) {
					var sLabelText = aTableCol[i].getAggregation("label").getText();
					var sProperty = aTableCol[i].getAggregation("template").getBindingPath("text");
					if (!sProperty) {
						sProperty = aTableCol[i].getAggregation("template").getBindingPath("value");
					}
					var sType = "string";
					switch (sProperty) {
						case "CreationDate":
						case "RequestedDeliveryDate":
						case "PostingDate":
							sType = "Date";
							break;
					}
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

    });
});