sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "../model/formatter",
	"./messages",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/ui/export/Spreadsheet",
	"sap/m/BusyDialog",
], (Controller,
    formatter,
	messages,
	Filter,
	MessageBox,
	Spreadsheet,
	BusyDialog) => {
    "use strict";

    return Controller.extend("pp.adjshippingplan.controller.Main", {
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
			var oNewFilter, aNewFilter = [];

			// 获取处理范围
			var oDateRange = this.byId("idDateRangeSelection");
			if ( this.vaildDate(oDateRange) ){
				return;
			}
			var oStartDate = oDateRange.getFrom();
			var oEndDate = oDateRange.getTo();
			
			if (oDateRange.getValue()) {
				// 如果未完整选择两个日期，则结束日期等于起始日期
				if (oStartDate && !oEndDate) {
					oEndDate = oStartDate;
				}
				aNewFilter.push(new Filter("ShippingPlanDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
			}
			if (this.byId("idFgOnly").getSelected()) {
				aNewFilter.push(new Filter("ProductType", "EQ", "ZFRT"));
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
					this._LocalData.setProperty("/AdjustShippingPlan", []);
					this._LocalData.setProperty("/AdjustShippingPlanTemp", []);
					// this.getEntityContentOnePage(iItemCount, 0, aFilter, sParamtetrsOfSelect);
					this.getEntityContentOnePage(iItemCount, 0, aFilter, undefined);
				} else {
					this._LocalData.setProperty("/AdjustShippingPlan", []);
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
				that.getOwnerComponent().getModel().read("/AdjustShippingPlan/$count", mParameters);
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

			var aResult = that._LocalData.getProperty("/AdjustShippingPlan");
			var aResultTemp = that._LocalData.getProperty("/AdjustShippingPlanTemp");
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
							that._LocalData.setProperty("/AdjustShippingPlan", aResultTemp);
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
								that._LocalData.setProperty("/AdjustShippingPlan", []);
							}
							that.aHttpRequest.forEach(function (req) {
								req.abort();
							});
							reject();
						}
					}
				};
				that.getOwnerComponent().getModel().setUseBatch(false);
				that.aHttpRequest.push(that.getOwnerComponent().getModel().read("/AdjustShippingPlan", mParameters));
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
					aResultTemp = that._LocalData.getProperty("/AdjustShippingPlanTemp");
					aResult = that.transformData(aResultTemp);
					that._LocalData.setProperty("/AdjustShippingPlan", aResult);
					that.addColumns();

					that.aHttpRequest = [];
					that._LocalData.refresh();
					that.dataFinished = true;
					// that.byId("idDynamicPage").setBusy(false);
				}
			});
			// aPromise.push(promise);
		},

		onRowsUpdated: function () {
			if (this.dataFinished) {
				this.byId("idDynamicPage").setBusy(false);
			}
		},

		transformData: function (data) {
			// 创建一个对象来存储转换后的数据
			let result = {};

			// 遍历数据数组
			data.forEach(item => {
				// 使用Plant, Material, LineType作为key值组合
				const key = `${item.Plant}_${item.Material}_${item.LineType}`;

				// 如果当前组合的key不存在于result中，则初始化它
				if (!result[key]) {
					result[key] = {
						// Type: item.Type,
						// Message: item.Message,
						Plant: item.Plant,
						Material: item.Material,
						Unit: item.Unit,
						LineType: item.LineType,
						LineTypeText: item.LineTypeText,
						MRPResponsible: item.MRPResponsible,
						Customer: item.Customer,
						MaterialByCustomer: item.MaterialByCustomer,
						TotalQuantity: item.TotalQuantity,
						Editable: item.Editable,
						PlanDates: {}
					};
				}

				// 将日期作为列名，使用Quantity填充
				let PlanDate = item.ShippingPlanDate.toISOString().slice(0,10).replace(/[^0-9]/g, '')
				// MOD END BY XINLEI XU 2025/02/27
				const dateKey = `PlanDate${PlanDate}`;
				result[key].PlanDates[dateKey] = item.Quantity;
			});

			// 将对象转化为数组形式，并将ReqDates展开为列
			return Object.values(result).map(item => {
				return {
					Customer: item.Customer,
					Plant: item.Plant,
					Material: item.Material,
					Unit: item.Unit,
					LineType: item.LineType,
					LineTypeText: item.LineTypeText,
					MRPResponsible: item.MRPResponsible,
					Customer: item.Customer,
					MaterialByCustomer: item.MaterialByCustomer,
					TotalQuantity: item.TotalQuantity,
					Editable: item.Editable,
					...item.PlanDates // 展开动态生成的日期列
				};
			});
		},

		addColumns: function () {
			var locaData = this._LocalData.getProperty("/AdjustShippingPlan");
			if (locaData.length > 0) {
				Object.keys(locaData[0]).forEach(function (key) {
					if (key.indexOf("PlanDate") >= 0) {
						this.addColumn(key, this);
					}
				}.bind(this));
			}
		},

		addColumn: function (sColName, oObj) {
			var sBindingPath = `{path:'local>${sColName}', type:'pp.adjshippingplan.controller.CustomDecimal'}`;
			// 生成input控件
			var oInput = new sap.m.Input({
				value: sBindingPath,
				editable: "{local>Editable}",
			});
			oInput.attachChange(this.onEditPlanQty.bind(this));

			var sLabel = sColName.slice(8);
			var sWidth = "8rem";
			var shAlign = "Begin";
			if (sColName.indexOf("PlanDate") >= 0) {
				shAlign = "End";
			}
			// 生成column id
			var sId = oObj.getView().createId(sColName);
			// 如果相同ID的column存在则删除(为了保证column的顺序，需要重新添加)
			if (oObj.byId(sId)) {
				oObj.byId(sId).destroyLabel();
				oObj.byId(sId).destroyTemplate();
				oObj.byId(sId).destroy(true);
			}
			// 往表中添加column
			var oColumn = new sap.ui.table.Column({
				id: oObj.getView().createId(sColName),
				hAlign: shAlign,
				label: sLabel,
				width: sWidth,
				template: oInput,
			});
			oObj.getView().byId("reportTable1").addColumn(oColumn);
		},
        onCreatePIR: function () {
			var aSelectedItem = this.preparePostBody();
			if (!aSelectedItem) {
				return
			}
			var aPromise = [];
			var that = this;
			aSelectedItem.forEach(function (line) {
				var aOrginalItem = that.transformBack(line);
				that.byId("idDynamicPage").setBusy(true);

				let postData = {
					Plant: line.Plant,
					Material: line.Material,
					Customer: line.Customer,
					Plant: line.Plant,
					to_Item: aOrginalItem
				}
				aPromise.push(that.postAction("processShippingPlan",JSON.stringify(postData)));
			}.bind(this));

			Promise.all(aPromise).then(function () {

			}).finally(function () {
				that.byId("idDynamicPage").setBusy(false);
			});
		},

		postAction: function (sAction, postData) {
			let that = this;
			that._BusyDialog.open();
			var oModel = that._oDataModel;
			var aAdjustShippingPlan = this._LocalData.getProperty("/AdjustShippingPlan");
			return new Promise( function (resolve, reject) {
				oModel.callFunction(`/${sAction}`, {
					method: "POST",
					// groupId: "myId",//如果设置groupid，会多条一起进入action
					changeSetId: 1,
					//建议只传输前端修改的参数，其他字段从后端获取
					urlParameters: {
						Event: sAction,
						Zzkey: postData
					},
					success: function (oData) {
						let object = JSON.parse(oData[sAction].Zzkey);

						// 更新message
						let aLineType = ["1","2","3"];
						aLineType.forEach(function(lineType){
							let searchKey = `${object.PLANT}_${object.MATERIAL}_${lineType}`;
							let item = aAdjustShippingPlan.find(item => {
								const key = `${item.Plant}_${item.Material}_${item.LineType}`;
								return key === searchKey;
							});
							if (item) {
								item.Type = object.TYPE;
								item.Message = object.MESSAGE;
							}
						});
						
						// // 更新pir数据
						// object._Item.forEach(function (line) {
						// 	const date = line.RequirementDate;
						// 	if (item) {
						// 		item[`ReqDate${date}`] = line.RequirementQty;
						// 	}
						// });
						that._LocalData.setProperty("/AdjustShippingPlan", aAdjustShippingPlan);

						that._BusyDialog.close();
						// that.getModel().refresh();
						resolve();
					},
					error: function (oError) {
						messages.showError(messages.parseErrors(oError));
						that._BusyDialog.close();
						reject();
					}
				});
			})
		},


		preparePostBody: function () {
			var postDocs = [];
			var oTable = this.byId("reportTable1");
			var listItems = oTable.getSelectedIndices();
			if (listItems.length === 0) {
				messages.showError(this._ResourceBundle.getText("msgNoSelect"));
				return;
			}
			if (listItems.length > 1) {
				messages.showError(this._ResourceBundle.getText("msgOnlyOneRow"));
				return;
			}
			listItems.forEach(_getData, this); //根据选择的行获取具体的数据
			function _getData(sSelected, index) { //sSelected为选中的行
				var key = oTable.getContextByIndex(sSelected).getPath();
				var lineData = this._LocalData.getProperty(key); //根据选中的行获取到ODATA键值，然后再获取到具体属性值
				// 只获取shipping plan行，如果选中的不是shipping plan也需要查找对应物料的shipping plan
				if (lineData.LineType === "1") {
					postDocs.push(JSON.parse(JSON.stringify(lineData)));
				} else {
					let aAdjustShippingPlan = this._LocalData.getProperty("/AdjustShippingPlan");
					let sLineType = "1";
					let searchKey = `${lineData.Plant}_${lineData.Material}_${sLineType}`;
					let item = aAdjustShippingPlan.find(item => {
						const key = `${item.Plant}_${item.Material}_${item.LineType}`;
						return key === searchKey;
					});
					if (item) {
						postDocs.push(JSON.parse(JSON.stringify(item)));
					}
				}
			}
			return postDocs;
		},

		transformBack: function (data) {
			const result = [];
			let isFisrtDate = true;
			// 遍历所有的 PlanDate 列，合并回原始形式
			Object.keys(data).forEach(key => {
				if (key.startsWith('PlanDate')) {
					const date = key.replace('PlanDate', ''); // 获取后面的日期
					// 本来只取数量大于0的数据，但特殊情况下，全部为0也要至少保证一条数据，所以使用isFisrtDate控制
					if (Number(data[`PlanDate${date}`]) > 0 || isFisrtDate) {
						isFisrtDate = false;
						result.push({
							Plant: data.Plant,
							Material: data.Material,
							Customer: data.Customer,
							RequirementDate: date,
							// RequirementMonth: date.substring(0, 6),
							RequirementQty: Number(data[`PlanDate${date}`]).toString(),
							Unit: data.Unit,
							MaterialByCustomer: data.MaterialByCustomer,

						});
					}
				}
			});
			return result;
		},

		onEditPlanQty: function (oEvent) {
			let iPlanValue = Number(oEvent.getParameter("value"));
			let sQtyProperty = oEvent.getSource().getBindingPath("value");
			let sPath = oEvent.getSource().getBindingContext("local").getPath();
			let oObject = oEvent.getSource().getBindingContext("local").getObject()
			let sPlanPath = "";

			//更新Plan数据
			sPlanPath = "/AdjustShippingPlan" + "/" + sQtyProperty
			this._LocalData.setProperty(sPlanPath,iPlanValue.toString());
			
			let aLocalData = this._LocalData.getProperty("/AdjustShippingPlan")
			//查找Actual行的index
			let iActualIndex = aLocalData.findIndex(function (item) {
				if ( item.Material === oObject.Material && item.Plant === oObject.Plant && item.LineType === "2" ) {
					return true;
				}
			});

			//计算差额
			let sActualPath = "/AdjustShippingPlan/" + iActualIndex + "/" + sQtyProperty;
			let iActualQuantity = Number(this._LocalData.getProperty(sActualPath));
			let iDifferenceQuantity = iActualQuantity - iPlanValue;

			//查找Difference行的index
			let iDifferenceIndex = aLocalData.findIndex(function (item) {
				if ( item.Material === oObject.Material && item.Plant === oObject.Plant && item.LineType === "3" ) {
					return true;
				}
			});

			let sDifferencePath = "";
			//获取Difference Total 数据
			sDifferencePath = "/AdjustShippingPlan/" + iDifferenceIndex + "/TotalQuantity";
			let iTotalDifference = Number(this._LocalData.getProperty(sDifferencePath));
			//获取Difference Qty旧数据
			sDifferencePath = "/AdjustShippingPlan/" + iDifferenceIndex + "/" + sQtyProperty;
			let iQtyDifference = Number(this._LocalData.getProperty(sDifferencePath));
			//计算新的Difference Total 数据
			iTotalDifference = iTotalDifference + iDifferenceQuantity - iQtyDifference;

			//更新Difference数据
			sDifferencePath = "/AdjustShippingPlan/" + iDifferenceIndex + "/" + sQtyProperty;
			this._LocalData.setProperty(sDifferencePath,iDifferenceQuantity.toString());
			//更新Difference Total 数据
			sDifferencePath = "/AdjustShippingPlan/" + iDifferenceIndex + "/TotalQuantity";
			this._LocalData.setProperty(sDifferencePath,iTotalDifference.toString());

			//因为difference total = actual total - plan total
			//那么plan total = actual total - difference total
			//获取Actual Total 数据
			sActualPath = "/AdjustShippingPlan/" + iActualIndex + "/" + "TotalQuantity";
			let iTotalActual = Number(this._LocalData.getProperty(sActualPath));
			//计算新的Plan Total 数据
			let iTotalPlan = iTotalActual - iTotalDifference;
			//更新Plan Total 数据
			sPlanPath = sPath + "/TotalQuantity";
			this._LocalData.setProperty(sPlanPath,iTotalPlan.toString());

		},

		onDateRangeChange: function(oEvent) {
			if ( this.vaildDate(oEvent.getSource()) ){
				return;
			}

			var oControl = oEvent.getSource();

			var oStartDate = oControl.getFrom();
			var oEndDate = oControl.getTo();
			// 如果未完整选择两个日期，则退出
			if (!oStartDate || !oEndDate) {
				return;
			}

			var sMode = this.byId("idProcessMode").getSelectedIndex()
			// 调用核心算法，计算最大允许的截止日期
			var oMaxEndDate = this._calculateMaxEndDate(oStartDate,sMode);
			
			// 比较用户选择的截止日期是否超过了最大允许日期
			if (oEndDate.getTime() > oMaxEndDate.getTime()) {
				// 1.给出错误提示
				switch(sMode) {
					case 0:
						sap.m.MessageToast.show("选择的时间范围不能超过一年", {
							duration: 3000
						});
						break;
						
					case 1:
						sap.m.MessageToast.show("选择的时间范围不能超过一个月", {
							duration: 3000
						});
						break;
				}
				
				// 2. 可选：自动将截止日期修正为最大允许值
				// oControl.setDateValue([oStartDate, oMaxEndDate]);
				
				// 3. 或者：清空选择，让用户重选（更清晰的交互）
				oControl.setValue("");
				oControl.setDateValue(null);
				oControl.focus();
			}
		},
		_calculateMaxEndDate: function(oStartDate,sMode) {
			// 创建一个起始日期的副本，避免修改原对象
			var oMaxEndDate = new Date(oStartDate.getTime());
			
			switch (sMode) {
				// 年份加1
				case 0:
					oMaxEndDate.setFullYear(oMaxEndDate.getFullYear() + 1);break;
				// 月份加1
				case 1:
					oMaxEndDate.setMonth(oMaxEndDate.getMonth() + 1);break;
			}
			
			return oMaxEndDate;
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
    });
});