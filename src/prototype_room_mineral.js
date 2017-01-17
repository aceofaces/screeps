'use strict';

Room.prototype.getNextReaction = function() {
  for (let mineralFirst in this.terminal.store) {
    if (!REACTIONS[mineralFirst]) {
      continue;
    }
    for (let mineralSecond in this.terminal.store) {
      if (!REACTIONS[mineralFirst][mineralSecond]) {
        continue;
      }
      let result = REACTIONS[mineralFirst][mineralSecond];
      if (this.terminal.store[result]) {
        continue;
      }
      //this.log('Could build: ' + mineralFirst + ' ' + mineralSecond + ' ' + result);
      return {
        result: result,
        first: mineralFirst,
        second: mineralSecond
      };
    }
  }
  return false;
};

Room.prototype.reactions = function() {
  if (!this.memory.reaction) {
    let result = this.getNextReaction();
    if (!result) {
      return;
    }

    let labsAll = this.find(FIND_MY_STRUCTURES, {
      filter: function(object) {
        if (object.structureType != STRUCTURE_LAB) {
          return false;
        }
        if (!object.mineralType) {
          return true;
        }
        if (object.mineralType == result.result) {
          return true;
        }
        return false;
      }
    });

    let lab;
    let labs = [];
    let getNearLabs = function(object) {
      if (object.id == lab.id) {
        return false;
      }
      if (object.structureType != STRUCTURE_LAB) {
        return false;
      }
      if (!object.mineralType) {
        return true;
      }
      if (object.mineralType == result.first) {
        return true;
      }
      if (object.mineralType == result.second) {
        return true;
      }
      return false;
    };

    for (lab of labsAll) {
      let labsNear = lab.pos.findInRange(FIND_MY_STRUCTURES, 2, {
        filter: getNearLabs
      });

      if (labsNear.length >= 2) {
        labs.push(lab.id);
        //        console.log(lab.mineralType, result.result);

        for (let labNear of labsNear) {
          if (!labNear.mineralType || labNear.mineralType == result.first) {
            //            console.log(labNear.mineralType, result.first);
            labs.push(labNear.id);
            break;
          }
        }
        for (let labNear of labsNear) {
          if (labNear.id == labs[1]) {
            continue;
          }
          if (!labNear.mineralType || labNear.mineralType == result.second) {
            //            console.log(labNear.mineralType, result.second);
            labs.push(labNear.id);
            break;
          }
        }
        break;
      }
    }
    if (labs.length < 3) {
      return false;
    }
    this.memory.reaction = {
      result: result,
      labs: labs
    };
    //    this.log('Setting reaction: ' + JSON.stringify(this.memory.reaction));
  }

  if (this.terminal.store[this.memory.reaction.result.result] > 1000) {
    this.log('Done with reaction:' + this.memory.reaction.result.result);
    delete this.memory.reaction;
  }
};

Room.prototype.orderMinerals = function() {
  let minerals = this.find(FIND_MINERALS);
  let resource = minerals[0].mineralType;

  if (Game.time % 20 === 0) {
    let baseMinerals = [
      RESOURCE_HYDROGEN,
      RESOURCE_OXYGEN,
      RESOURCE_UTRIUM,
      RESOURCE_LEMERGIUM,
      RESOURCE_KEANIUM,
      RESOURCE_ZYNTHIUM,
      RESOURCE_CATALYST,
      RESOURCE_GHODIUM
    ];
    let compounds = [
      RESOURCE_HYDROXIDE,
      RESOURCE_ZYNTHIUM_KEANITE,
      RESOURCE_UTRIUM_LEMERGITE,
      RESOURCE_UTRIUM_HYDRIDE,
      RESOURCE_UTRIUM_OXIDE,
      RESOURCE_KEANIUM_HYDRIDE,
      RESOURCE_KEANIUM_OXIDE,
      RESOURCE_LEMERGIUM_HYDRIDE,
      RESOURCE_LEMERGIUM_OXIDE,
      RESOURCE_ZYNTHIUM_HYDRIDE,
      RESOURCE_ZYNTHIUM_OXIDE,
      RESOURCE_GHODIUM_HYDRIDE,
      RESOURCE_GHODIUM_OXIDE,
    ]

    let room = this;
    let orderByDistance = function(object) {
      return Game.map.getRoomLinearDistance(room.name, object);
    };

    for (let mineral of baseMinerals) {
      if (!this.terminal.store[mineral]) {
        let roomsOther = _.sortBy(Memory.myRooms, orderByDistance);

        for (let roomOtherName of roomsOther) {
          if (roomOtherName == this.name) {
            continue;
          }
          let roomOther = Game.rooms[roomOtherName];
          if (!roomOther || roomOther === null) {
            continue;
          }
          let minerals = roomOther.find(FIND_MINERALS);
          if (minerals.length === 0) {
            continue;
          }
          let mineralType = minerals[0].mineralType;
          if (!roomOther.terminal || roomOther.terminal[minerals[0].mineralType] < config.mineral.minAmount) {
            continue;
          }
          if (mineralType == mineral) {
            roomOther.memory.mineralOrder = roomOther.memory.mineralOrder || {};
            if (roomOther.memory.mineralOrder[room.name]) {
              break;
            }
            roomOther.memory.mineralOrder[room.name] = 1000;
            //            room.log('Ordering ' + mineralType + ' from ' + roomOther.name);
            break;
          }
        }
      }
    }

    for (let compound of compounds) {
      if (!this.terminal.store[compound]) {
        let roomsOther = _.sortBy(Memory.myRooms, orderByDistance);

        for (let roomOtherName of roomsOther) {
          if (roomOtherName == this.name) {
            continue;
          }
          let roomOther = Game.rooms[roomOtherName];
          if (!roomOther || roomOther === null) {
            continue;
          }
          if (!roomOther.terminal) {
            continue;
          }
          if ( !(compound in roomOther.terminal.store) ) {
            continue;
          }
          if (!roomOther.terminal || roomOther.terminal.store.mineral < config.mineral.minAmount) {
            continue;
          }
          roomOther.memory.compoundOrder = roomOther.memory.compoundOrder || {};
          if (roomOther.memory.compoundOrder[room.name]) {
            break;
          }
          roomOther.memory.compoundOrder[room.name] = compound;
          break;
        }
      }
    }
  }
}

Room.prototype.handleTerminal = function() {
  if (!this.terminal) {
    return false;
  }

  this.orderMinerals();
  this.reactions();

  if (!this.memory.mineralOrder || Object.keys(this.memory.mineralOrder).length === 0 || !this.memory.compoundOrder || Object.keys(this.memory.compoundOrder).length === 0) {
    return false;
  }

  if (this.memory.mineralOrder || Object.keys(this.memory.mineralOrder).length > 0) {
    let minerals = this.find(FIND_MINERALS);
    if (minerals.length === 0) {
      return false;
    }
    let resource = minerals[0].mineralType;

    let roomOtherName = Object.keys(this.memory.mineralOrder)[0];
    let roomOther = Game.rooms[roomOtherName];
    let order = this.memory.mineralOrder[roomOtherName];
    let linearDistanceBetweenRooms = Game.map.getRoomLinearDistance(this.name, roomOtherName);
    let energy = Math.ceil(0.1 * order * linearDistanceBetweenRooms);

    if (this.terminal.store.energy < energy) {
      //this.log('Terminal not enough energy');
      this.memory.terminalTooLessEnergy = true;
      return false;
    }

    this.memory.terminalTooLessEnergy = false;

    if (this.terminal.store[resource] < order) {
      return false;
    }
    this.terminal.send(resource, order, roomOtherName);
    delete this.memory.mineralOrder[roomOtherName];
//    return true;
  }

  if (this.memory.compoundOrder || Object.keys(this.memory.compoundOrder).length > 0) {
    let roomOtherName = Object.keys(this.memory.compoundOrder)[0];
    let compound = this.memory.compoundOrder[roomOtherName]
    let roomOther = Game.rooms[roomOtherName];
    let order = 250;
    let linearDistanceBetweenRooms = Game.map.getRoomLinearDistance(this.name, roomOtherName);
    let energy = Math.ceil(0.1 * order * linearDistanceBetweenRooms);

    if (this.terminal.store.energy < energy) {
      //this.log('Terminal not enough energy');
      this.memory.terminalTooLessEnergy = true;
      return false;
    }

    this.memory.terminalTooLessEnergy = false;

    if (this.terminal.store[compound] < order) {
      return false;
    }
    this.terminal.send(compound, order, roomOtherName);
    delete this.memory.compoundOrder[roomOtherName];
    return true;
  }

};
