sap.ui.define([
	"./BaseController",
	"../model/formatter",
	"./messages",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/plugins/CellSelector",
	"sap/m/plugins/CopyProvider",
	"sap/ui/core/Messaging",
	'sap/ui/core/message/Message',
	'sap/ui/core/message/MessageType',
	"sap/ui/core/Fragment",
], (BaseController,formatter,messages,JSONModel,MessageToast,MessageBox,CellSelector,CopyProvider,Messaging,Message, MessageType,Fragment) => {
	"use strict";
	let oCellSelector;
	let oCopyProvider;
	return BaseController.extend("pp.ecnmanagement.controller.Detail", {
		formatter: formatter,
		onInit() {
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this._BusyDialog = new sap.m.BusyDialog();

			this.sAssignTableId = "";
			
			var oRouter = this.getRouter();
			oRouter.getRoute("Detail").attachMatched(this._onRouteMatched, this);

			// //Copy Button
			// if (window.isSecureContext) {
			// 	const oTable = this.byId("idObjectMaterialTable");
			// 	oCellSelector = new CellSelector();
			// 	oTable.addDependent(oCellSelector);

			// 	oCopyProvider = new CopyProvider({extractData: this.extractData, copy: this.onCopy});
			// 	oTable.addDependent(oCopyProvider);

			// 	const oToolbar = this.byId("idObjectMaterialTableToolbar");
			// 	oToolbar.addContent(oCopyProvider.getCopyButton());
			// }

			// set message model
			Messaging.removeAllMessages();

			this.getView().setModel(Messaging.getMessageModel(), "message");

			//activate automatic message generation for complete view
			Messaging.registerObject(this.getView(), true);

			var eventBus = this.getOwnerComponent().getEventBus();
			eventBus.subscribe("channel1","save", this.onSave.bind(this));//这里的第一个参数和第二个参数和messages.confirmAction传输的第三第四参数保持一致。（也就是channel和eventId）

		},

		_onRouteMatched: function (oEvent) {
			let isRouteFormMainView = this._LocalData.getProperty("/routeFormMain");
			if (!isRouteFormMainView) {
				//权限校验在Main页面，所以不能通过url访问详细页面
				this.getRouter().navTo("RouteMain");
				return;
			}
			this._LocalData.setProperty("/routeFormMain",false);

			Messaging.removeAllMessages();
			this.resetControlState();
			this._oDataModel.resetChanges();
            let oArgs = oEvent.getParameter("arguments");
			this.DetermineProcessingMode(oArgs);
		},

		async DetermineProcessingMode (oArgs) {
			this.clearJsonData();
			let oContext = {
				ChangeNumber:oArgs.changeNumber,
			};
			let sPath = "/" + this._oDataModel.createKey("EcnManagement",oContext);
			
			await this.readOdataV2(sPath);
			let detailMode = this._LocalData.getProperty("/detailMode");
			switch(detailMode) {
				case 'change':
					this.changeDetail(sPath);
					break;
				case 'create':
					this.createDetail(oArgs);
					break;
			}
		},

		clearJsonData: function () {
			let that = this;
			that._LocalData.setProperty("/to_Item", [])
			that._LocalData.setProperty("/to_Material", [])
			that._LocalData.setProperty("/to_Bom", [])
			that._LocalData.setProperty("/to_AltDate", [])
		},

		resetControlState: function () {
			let oControl = this.byId("idSmartFormHead");
			oControl.getSmartFields().forEach(function(oSmartField){
				let aInnerControls = oSmartField.getInnerControls();
				aInnerControls.forEach(function(oInnerControl){
					if (oInnerControl.setValueState && oInnerControl.setValueStateText) {
						oInnerControl.setValueState(sap.ui.core.ValueState.None); // 重置状态为“无”
        				oInnerControl.setValueStateText(""); // 清空错误提示文本
					}
				});
			});
		},

		readOdataV2: function (sPath) {
			let that = this;
			that._BusyDialog.open();
			return new Promise(function (resolve, reject) {
				var mParameters = {
					urlParameters: {
						"$expand": "to_Item,to_Material,to_Bom,to_AltDate",
					},
					success: function (oResponse) {
						that._LocalData.setProperty("/detailMode","change");

						let aItems = oResponse.to_Item.results;
						aItems.forEach(e => e.isDraft = false);
						let aMaterial = oResponse.to_Material.results;
						aMaterial.forEach(e => e.isDraft = false);
						let aBom = oResponse.to_Bom.results;
						aBom.forEach(e => e.isDraft = false);
						let aAltDate = oResponse.to_AltDate.results;
						aAltDate.forEach(e => e.isDraft = false);
						that._LocalData.setProperty("/to_Item", aItems ? aItems : [])
						that._LocalData.setProperty("/to_Material", aMaterial ? aMaterial : [])
						that._LocalData.setProperty("/to_Bom", aBom ? aBom : [])
						that._LocalData.setProperty("/to_AltDate", aAltDate ? aAltDate : [])

						that._BusyDialog.close();
						resolve(oResponse);
					},
					error: function (oErr) {
						that._LocalData.setProperty("/detailMode","create");
						
						let isNoEntryError = false;
						Messaging.getMessageModel().getData().forEach(function(e){
							//如果是新建的ECO 取不到值会报错，忽略此条错误
							if (e.code === "/IWBEP/CM_MGW_RT/020") {
								Messaging.removeMessages(e);
								isNoEntryError = true;
							}
						});
						// 除了取值的报错，还会有一条异常的消息，一起删除
						if (isNoEntryError) {
							Messaging.removeMessages(Messaging.getMessageModel().getData().filter(e => e.code === "/IWBEP/CX_MGW_BUSI_EXCEPTION"));
						}
						that._BusyDialog.close();
						resolve();
					}
				};
				that.getOwnerComponent().getModel().read(sPath, mParameters);
			});
		},

		changeDetail: function (sPath) {
			let oView = this.getView();
			oView.bindElement({
				path: sPath,
				events: {
					dataRequested: function (oEvent) {
						oView.setBusy(true);
					},
					dataReceived: function (oEvent) {
						oView.setBusy(false);
					}.bind(this)
				}
			});
			//如果绑定了createEntry 创建的context 不单独对每个控件绑定的话 无法更新绑定
			this.byId("idSmartFormHead").bindElement({
				path: sPath
			});
			this._LocalData.setProperty("/viewEditable",false);
			
		},

		createDetail: function(oArgs) {
			let that = this;
			let sUser = this.getUser();
			let sEmail = this.getEmail();
			if (!sEmail) {
				sEmail = "siyun.yao@sh.shin-china.com";
			}
			var oHeadContext = this.createEntryWithPromise("/EcnManagement", 
				{ 
					ChangeNumber: oArgs.changeNumber,
					CompanyCode: oArgs["?queryParameter"].companyCode,
					Plant: oArgs["?queryParameter"].plant,
					UnitSfgSmt: 'PC',
					UnitSfgFat: 'PC',
					UnitNcgSmt: 'PC',
					UnitNcgFat: 'PC',
					UnitFg: 'PC',
					CreatedByUser: sUser,
					CreatedByEmail: sEmail
				});

			this.byId("idSmartFormHead").unbindObject();
			this.byId("idSmartFormHead").setBindingContext(oHeadContext);

			this.initObjectTypeData(oHeadContext);
			this._LocalData.setProperty("/viewEditable",true);
		},

		initObjectTypeData: function (oHeadContext) {
			let oObject = oHeadContext.getObject();
			let sItemsPath = this.getView().byId("idObjectTypeTable").getBindingPath("rows");
			let aItems = this._LocalData.getProperty(sItemsPath)
			aItems.push(
				{
					ChangeNumber: oObject.ChangeNumber,
					ObjectType:"02",
					ObjectTypeText: this._ResourceBundle.getText("ObjectTypeText02"),
					ObjectTypeActive:true,
					ObjectFlag:true 
				},
				{
					ChangeNumber: oObject.ChangeNumber,
					ObjectType:"41",
					ObjectTypeText: this._ResourceBundle.getText("ObjectTypeText41"),
					ObjectTypeActive:true,
					ObjectFlag:true 
				});
			this._LocalData.setProperty(sItemsPath,aItems);

			sItemsPath = this.getView().byId("idObjectMaterialTable").getBindingPath("rows");
			this._LocalData.setProperty(sItemsPath,[]);
			sItemsPath = this.getView().byId("idObjectBomTable").getBindingPath("rows");
			this._LocalData.setProperty(sItemsPath,[]);
			sItemsPath = this.getView().byId("idObjectAltDateTable").getBindingPath("rows");
			this._LocalData.setProperty(sItemsPath,[]);
		},

		onSmartFormEditToggled: function (oEvent) {
			this._LocalData.setProperty("/viewEditable",oEvent.getParameter("editable"));
		},

		//use for copy paste
		extractData: function(oRowContext, oColumn) {
			const oValue = oRowContext.getProperty(oColumn.getSortProperty());
			return oColumn.__type ? oColumn.__type.formatValue(oValue, "string") : oValue;
		},
		//use for copy paste
		onCopy: function(oEvent) {
			MessageToast.show("Selection copied to clipboard");
		},

		createEntryWithPromise: function (sPath, line) {
			let oContext = {};
			let promise = new Promise(function (resolve, reject) {
				var mParameters = {
					// groupId: "group1",
					properties: line,
					// inactive: true,
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this),
				};
				oContext = this._oDataModel.createEntry(sPath, mParameters);
			}.bind(this));
			// return promise;
			return oContext;
		},

		onSave: function() {
			Messaging.removeAllMessages();

			let sMode = this._LocalData.getProperty("/detailMode");
			switch(sMode) {
				//新建
				case "create":
					//之前自建表保存和S4单据数据保存分两步，现在合并一步
					// this.postAction("processLogic","create",this.getCreateData());
					this.postAction("processLogic","post",this.getCreateData());
					break;
				//修改
				case "change":
					//之前自建表保存和S4单据数据保存分两步，现在合并一步
					// this.postAction("processLogic","change",this.getChangeData());
					this.postAction("processLogic","post",this.getChangeData());
					break;
			}
		},
		onSaveToS4: function (oEvent) {
			Messaging.removeAllMessages();
			//生成S4凭证
			this.postAction("processLogic","post",this.getChangeData());
		},

		onAddLine: function (oEvent,sType) {
			let oHeadObject = this.byId("idSmartFormHead").getBindingContext().getObject();
			let sItemsPath = oEvent.getSource().getParent().getParent().getBindingPath("rows");
			let aItems = this._LocalData.getProperty(sItemsPath)
			switch (sType) {
				case "material":
					aItems.push({
						ChangeNumber: oHeadObject.ChangeNumber,
						ObjectType:"41",
						ObjectTypeText: this._ResourceBundle.getText("ObjectTypeText41")
					});
					break;
				case "bom":
					aItems.push({
						ChangeNumber: oHeadObject.ChangeNumber,
						ObjectType:"02",
						ObjectTypeText: this._ResourceBundle.getText("ObjectTypeText02")
					});
					break;
				case "altDate":
					aItems.push({
						ChangeNumber: oHeadObject.ChangeNumber,
					});
					break;
			}
			this._LocalData.setProperty(sItemsPath,aItems);
		},

		onDeleteLine: async function (oEvent,sType) {
			let oTable = oEvent.getSource().getParent().getParent();
			let aSelectedIndex = oTable.getSelectedIndices();
			let sItemsPath = oTable.getBinding("rows").sPath;
			let aItems = this._LocalData.getProperty(sItemsPath);
			aSelectedIndex.reverse();
			for (let index = 0; index < aSelectedIndex.length; index++) {
				let selected = aSelectedIndex[index];
				let sPath = oTable.getRows()[selected].getBindingContext("local").sPath;
				let oItem = this._LocalData.getProperty(sPath);
				if (sType === "bom") {
					try {
						await this.checkDelete("checkDelete",sType,oItem);
					} catch (error) {
						continue;
					}
				}
				if (sType === "altDate" && oItem.AssignFlag) {
					messages.showError(this._ResourceBundle.getText("msg08",[oItem.AlternativeDateId]));
					continue;
				}
				aItems.splice(sPath.split("/")[2], 1);
			}
			this._LocalData.setProperty(sItemsPath,aItems);
		},

		checkDelete: function (sAction,sEvent,postData) {
			var that = this;
			this._BusyDialog.open();
			var oModel = this._oDataModel;
			return new Promise(function (resolve, reject) {
				oModel.callFunction(`/${sAction}`, {
					method: "POST",
					changeSetId: 1,
					urlParameters: {
						Event: sEvent,
						Zzkey: JSON.stringify(postData),
					},
					success: function (oData) {
						that._BusyDialog.close();
						resolve();
					},
					error: function (oError) {
						that._BusyDialog.close();
						reject();
					}
				});
			});
			
		},

		onAssign: function (oEvent,sTableId) {
			this.sAssignTableId = sTableId;
			// 获取选中的行索引
			var aSelectedIndices = this.byId(sTableId).getSelectedIndices();

			if (aSelectedIndices.length === 0) {
				messages.showError(this._ResourceBundle.getText("msg03"));
				return;
			}

			if (this._LocalData.getProperty("/to_AltDate").length === 0){
				messages.showError(this._ResourceBundle.getText("msg07"));
				return;
			}
			let oHeadObject = this.byId("idSmartFormHead").getBindingContext().getObject();
			if (oHeadObject.isCreatedInS4) {

			}

			var	oView = this.getView();

			if (!this._pDialog) {
				this._pDialog = Fragment.load({
					id: oView.getId(),
					name: "pp.ecnmanagement.fragment.AlternativeDate",
					controller: this
				}).then(function(oDialog){
					oView.addDependent(oDialog);
					return oDialog;
				});
			}

			this._pDialog.then(function(oDialog){
				// this._configDialog(oButton, oDialog);
				oDialog.open();
			}.bind(this));
		},

		onAssignDialogClose: function (oEvent) {
			// reset the filter
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);

			var oContext = oEvent.getParameter("selectedItem")?.getBindingContext("local");
			if (oContext) {
				let oTable = this.byId(this.sAssignTableId);
				let aSelectedIndex = oTable.getSelectedIndices();

				aSelectedIndex.forEach( function(selected) {
					let sPath = oTable.getRows()[selected].getBindingContext("local").sPath
					this._LocalData.setProperty(sPath + "/AlternativeDateId",oContext.getObject().AlternativeDateId);
					this._LocalData.setProperty(sPath + "/ObjectValidFrom",oContext.getObject().ObjectValidFrom);
				}.bind(this));

				let sMessage = this._ResourceBundle.getText("msg02",[oContext.getObject().AlternativeDateId]);
				MessageToast.show(sMessage);
			}
			this.checkAssigned();

		},

		onAssignCancel: function (oEvent,sTableId) {
			let oTable = this.byId(sTableId);
			let aSelectedIndex = oTable.getSelectedIndices();

			aSelectedIndex.forEach( function(selected) {
				let sPath = oTable.getRows()[selected].getBindingContext("local").sPath
				this._LocalData.setProperty(sPath + "/AlternativeDateId","");
				this._LocalData.setProperty(sPath + "/ObjectValidFrom","");
			}.bind(this));
			let sMessage = this._ResourceBundle.getText("msg04");
			MessageToast.show(sMessage);
			this.checkAssigned();
		},

		checkAssigned: function () {
			let that = this;
			let isAssigned = false;
			let oJsonData = this.getLocalData();
			oJsonData.aEcnAltDate.forEach(function (altDate) {
				isAssigned = false;
				if ( oJsonData.aEcnMaterial.findIndex(e => e.AlternativeDateId == altDate.AlternativeDateId) >= 0 ) {
					isAssigned = true;
				}
				if ( oJsonData.aEcnBom.findIndex(e => e.AlternativeDateId == altDate.AlternativeDateId) >= 0) {
					isAssigned = true;
				}
				altDate.AssignFlag = isAssigned;
			});
			this._LocalData.setProperty("/to_AltDate",oJsonData.aEcnAltDate);
		},

		//当 oata context更新时（比如删除某些条目）好像会根据metadata重新设置editable
		//导致有些不能编辑的smartfield变成可编辑
		onEditableChanged: function(oEvent) {
			// let isEditable = this._LocalData.getProperty("/viewEditable");
			// oEvent.getSource().setEditable(false);
		},

		onChangeNumberEditableChanged: function(oEvent) {
			oEvent.getSource().setEditable(false);
		},

		onInputChange: function (oEvent,sModel) {
			var oModel =this.getModel(sModel);
			var sPath = oEvent.getSource().getBindingContext(sModel).getPath();
			var sProperty = oEvent.getSource().getBindingPath("value");
			switch (oEvent.getSource().getDataType()) {
				case 'Edm.DateTime':
				case 'Edm.Date':
					oModel.setProperty(sPath + "/" + sProperty, this.formatter.odataDate(oEvent.getParameter('value')));
					break;
				default:
					oModel.setProperty(sPath + "/" + sProperty, oEvent.getParameter('value'));
					break;
			}
		},
		onCheckBoxChange: function (oEvent) {
			var sPath = oEvent.getSource().getBindingContext().getPath();
			var sProperty = oEvent.getSource().getBindingPath("selected");
			this._oDataModel.setProperty(sPath + "/" + sProperty, oEvent.getParameter('selected'));
		},

		//Replace the Odata model of Smartfield with a JSON model
        onInnerControlsCreated: function(oEvent) {
            var oInnerControl = oEvent.getParameter("0"); 
            var sPath = "local>" + oEvent.getSource().getBindingPath("value")
			if (oInnerControl instanceof sap.m.Input || oInnerControl instanceof sap.m.DatePicker) {
				oInnerControl.bindValue(sPath);
			}
			if (oInnerControl instanceof sap.m.Text) {
				oInnerControl.bindText(sPath);
			}
			//未测试
			// if (oInnerControl instanceof sap.m.CheckBox) {
			// 	oInnerControl.bindProperty("selected",sPath);
			// }
        },
		
		postData: function (postData) {
			var promise = new Promise(function(resolve,reject){
                var mParameters = {
                    // groupId: "group1",
                    changeSetId: 1,
                    success: function (oData, response) {
                        // let sPath = oData.__metadata.uri.split("ZZNAMEPLATECREATION_SRV")[1]
                        // let oContext = this._oDataModel.getContext(sPath);
                        // resolve(oContext);
                        // this._BusyDialog.close();
                    }.bind(this),
                    error: function (oError) {
                        // messages.showError(messages.parseErrors(oError));
                        // reject();
                        // this._BusyDialog.close();
                    }.bind(this),
                };
                // this.getOwnerComponent().getModel().setHeaders({"pressaction":this.sAction});
                this.getOwnerComponent().getModel().create("/EcnManagement", postData, mParameters);
            }.bind(this));
            return promise;
			
		},

		postAction: function (sAction, sEvent, postData) {
			var that = this;
			this._BusyDialog.open();
			var oModel = this._oDataModel;
			postData.ChangedByUser = that.getUser();
			postData.ChangedByEmail = that.getEmail();

			oModel.callFunction(`/${sAction}`, {
				method: "POST",
				changeSetId: 1,
				urlParameters: {
					Event: sEvent,
					Zzkey: JSON.stringify(postData),
				},
				success: function (oData) {
					let sPath = this.getEntitykey(this.byId("idSmartFormHead").getBindingContext().getObject());
					this.readOdataV2(sPath);
					this._BusyDialog.close();
					switch(sEvent){
						case "create":
							Messaging.addMessages(
								new Message({
									message: this._ResourceBundle.getText("msg05",[postData.ChangeNumber]),
									type: MessageType.Success,
									processor: that._LocalData
								})
							);
							this.onSaveToS4();
							break;
						case "change":
							Messaging.addMessages(
								new Message({
									message: this._ResourceBundle.getText("msg06",[postData.ChangeNumber]),
									type: MessageType.Success,
									processor: that._LocalData
								})
							);
							this.onSaveToS4();
							break;
						case "post":
							this._LocalData.setProperty("/viewEditable",false);
							break;
					}
				}.bind(this),
				error: function (oError) {
					
					this._BusyDialog.close();
					// this.getModel().refresh();
				}.bind(this)
			});
		},
		
		getCreateData: function () {
			let oPendingChanges = this._oDataModel.getPendingChanges();
			if (!oPendingChanges) {
				return;
			}
			// 获取抬头数据
			let oData = this.extractPendingChanges(oPendingChanges);
			
			let oJsonData = this.getLocalData();

			let postData= {
				//抬头数据应该只有一条
				...oData["EcnManagement"][0],
				to_Item: oJsonData.aEcnManagementItem,
				to_Material: oJsonData.aEcnMaterial,
				to_Bom: oJsonData.aEcnBom,
				to_AltDate: oJsonData.aEcnAltDate,
			}
			return postData;
			// return oData;
		},

		getChangeData: function () {
			let sPath = this.byId("idSmartFormHead").getBindingContext().getPath();
			let postData = this._oDataModel.getProperty(sPath);
			
			// let oPendingChanges = this._oDataModel.getPendingChanges();
			// if (oPendingChanges) {
			// 	// 获取抬头数据
			// 	var oData = this.extractPendingChanges(oPendingChanges);
			// 	var oEcnManagement = oData.EcnManagement[0];
			// 	Object.getOwnPropertyNames(oEcnManagement).forEach(function (sProperty) {
			// 		postData[sProperty] = oEcnManagement[sProperty];
			// 	});
			// }
			
			let oJsonData = this.getLocalData();

			postData.to_Item = oJsonData.aEcnManagementItem;
			postData.to_Material = oJsonData.aEcnMaterial;
			postData.to_Bom = oJsonData.aEcnBom;
			postData.to_AltDate = oJsonData.aEcnAltDate;

			return postData;
		},

		extractPendingChanges: function (pendingChanges) {
			const result = {};
			
			Object.entries(pendingChanges).forEach(([key, value]) => {
				const entityType = key.split('(')[0];
				// // 创建新对象并排除 __metadata
    			// const { __metadata, ...cleanData } = value;

				// const cleanData = JSON.parse(JSON.stringify(value));
				const cleanData = value;
				delete cleanData.__metadata;
				
				result[entityType] = result[entityType] || [];
				result[entityType].push(cleanData);
			});
			
			return result;
		},

		getLocalData: function () {
			let aEcnManagementItem = this._LocalData.getProperty("/to_Item");
			let aEcnMaterial = this._LocalData.getProperty("/to_Material");
			let aEcnBom = this._LocalData.getProperty("/to_Bom");
			let aEcnAltDate = this._LocalData.getProperty("/to_AltDate");

			let oJsonData = {aEcnManagementItem,aEcnMaterial,aEcnBom,aEcnAltDate};
			return oJsonData;
		},

		onCheckRecords: function () {
			var that = this;
			Messaging.removeAllMessages();

			this.byId("idSmartFormHead").check();

			let oJsonData = this.getLocalData();

			var sItemPath = "/to_Material/";
			//必输校验
			oJsonData.aEcnMaterial.forEach(function(item,index){
				if (!item.Material) {
					that.addRquiredFieldMessage(sItemPath,index,"Material","MaterialSF");
				}
			});
			//必输校验
			sItemPath = "/to_Bom/";
			oJsonData.aEcnBom.forEach(function(item,index){
				if (!item.Material) {
					that.addRquiredFieldMessage(sItemPath,index,"Material","MaterialSF");
				}
				if (!item.Plant) {
					that.addRquiredFieldMessage(sItemPath,index,"Plant","PlantSF");
				}
				if (!item.BomUsage) {
					that.addRquiredFieldMessage(sItemPath,index,"BomUsage","BomUsageSF");
				}
			});
			//必输校验
			sItemPath = "/to_AltDate/";
			oJsonData.aEcnAltDate.forEach(function(item,index){
				if (!item.AlternativeDateId) {
					that.addRquiredFieldMessage(sItemPath,index,"AlternativeDateId","AlternativeDateIdSF");
				}
				if (!item.ObjectValidFrom) {
					that.addRquiredFieldMessage(sItemPath,index,"ObjectValidFrom","ObjectValidFromSF");
				}
			});

			if (Messaging.getMessageModel().getData().length > 0) {
				return;
			}
			let oHeadObject = this.byId("idSmartFormHead").getBindingContext().getObject();
			if (!oHeadObject.AttachedDocuments) {
				this.onEventPublish();
			} else {
				this.onSave.call(this);
			}
		},

		addRquiredFieldMessage: function (sItemPath,index,sProperty,sLabel) {
			var that = this;
			let sFieldName = that._ResourceBundle.getText(sLabel);
			let sText1 = that._ResourceBundle.getText("msg01",[sFieldName]);
			let sTarget = sItemPath + index + "/" + sProperty;
			Messaging.addMessages(
				new Message({
					message: sText1,
					type: MessageType.Error,
					target: sTarget,
					processor: that._LocalData
				})
			);
		},

		onCancel: function() {
			this._oDataModel.resetChanges();
			let sPath = this.getEntitykey(this.byId("idSmartFormHead").getBindingContext().getObject());
			this.readOdataV2(sPath);
		},

		onEventPublish: function(oEvent) {	
			var sEventId = "save";		
			var sMessageText = this._ResourceBundle.getText("msgConfirmation");

			messages.confirmAction("Confirmation",
								sMessageText, 
								"channel1",
								sEventId,
								this);//传this是固定的，因为confirmAction中需要使用到
		},

		async onMessagePopoverPress(oEvent) {
			const oSourceControl = oEvent.getSource();
			const oMessagePopover = await this._getMessagePopover();
			oMessagePopover.openBy(oSourceControl);
		},
		_getMessagePopover() {
			if (!this.MessageDialog) {
				this.MessageDialog = this.loadFragment({
					name: "pp.ecnmanagement.fragment.MessagePopover"
				});
			}
			return this.MessageDialog;
		},

		getEntitykey: function(oObject) {
			let oContext = {
				ChangeNumber: oObject.ChangeNumber,
			};
			return "/" + this._oDataModel.createKey("EcnManagement",oContext);
		},
	});
});