"use strict";

let game = new Phaser.Game(1280, 720, Phaser.AUTO, '', { preload: preload, create: create, update: update });
let displayHandler, players, walls, windGroup;
//Other players' knives might not need to be simulated if the wind is synced well enough. Other players still ought to be for hit detection purposes -- both movement and knife-stabbing. 

//Keybind abstraction, I guess. Just some javascript for its own sake, because I doubt we're ever going to want to rebind the keys.
let MOVEMENT =
Object.seal({
    LEFT: Phaser.Keyboard.A,
    RIGHT: Phaser.Keyboard.D,
    UP: Phaser.Keyboard.W,
    DOWN: Phaser.Keyboard.S,
	DEBUGKEY_CPULEFT: Phaser.Keyboard.J,
	DEBUGKEY_CPURIGHT: Phaser.Keyboard.L,
	DEBUGKEY_CPUUP: Phaser.Keyboard.I,
	DEBUGKEY_CPUDOWN: Phaser.Keyboard.K,
	DEBUGKEY_CPUKNIFELEFT: Phaser.Keyboard.LEFT,
	DEBUGKEY_CPUKNIFERIGHT: Phaser.Keyboard.RIGHT,
	DEBUGKEY_CPUKNIFEUP: Phaser.Keyboard.UP,
	DEBUGKEY_CPUKNIFEDOWN: Phaser.Keyboard.DOWN,
});

//TODO (consider) moving breeze stuff into its own class. Maybe do the same for player stuff too.
let windSpeed = 0;
let windPhase = 0;
let windDirection = 0;
const breezeForce = 3;
const breezeRotationSpeed = 0.00001;
const breezeBackAndForthSpeed = 0.0001;

function preload() {
    game.load.image('skyBackground', 'assets/sky.png');
    game.load.image('playerSprite', 'assets/player.png');
    game.load.image('wallSprite', 'assets/wall.png');
}

function create() {
    game.time.advancedTiming = true;
    game.physics.startSystem(Phaser.Physics.ARCADE);

	//Adding things to world
	//Stuff is rendered in the order it's added (back to front)
	//Desired order: Background < Wind (to be added later) < Players < Walls < HUD

	let WORLD_WIDTH = 2000;
	let WORLD_HEIGHT = 2000;
    game.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'skyBackground');
	game.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

	displayHandler = new HUD();

/*
	let WIND_INTERVAL = 50;
	windGroup = game.add.group();
	windGroup.enableBody = true;
	for(let x = WIND_INTERVAL/2; x < WORLD_WIDTH; x += WIND_INTERVAL)
	{
		for(let y = WIND_INTERVAL/2; y < WORLD_HEIGHT; y += WIND_INTERVAL)
		{
			let newWind = windGroup.create(x, y, 'playerSprite');
			newWind.scale.setTo(1/5, 1/5);
			newWind.body.mass = 0.5;
			//newWind.body.velocity.y = -5000;
		}
	}
*/

	walls = game.add.group();
	walls.enableBody = true;

	//Wallsprite is 50px*50px, scale is multiplicative
	let newWall = walls.create(game.world.width/4-25, game.world.height/4-25, 'wallSprite');
	newWall.scale.setTo(2, 1);
	newWall.body.immovable = true;

	newWall = walls.create(1000, 1100, 'wallSprite');
	newWall.scale.setTo(5, 5);
	newWall.body.immovable = true;

	players = [];
	players.push(new LocalPlayer("Local Player"));

	//Adding NPCs -- dummy characters for now, networked players later.
	players.push(new GameCharacter("CPU Player #1"));
	players.push(new GameCharacter("CPU Player #2"));


	//Todo in the future: Change arrow keys to WASD
	game.input.keyboard.addKeyCapture([MOVEMENT.UP, MOVEMENT.DOWN, MOVEMENT.LEFT, MOVEMENT.RIGHT]);
}

function update() {
/*
	//Collision groups
	game.physics.arcade.collide(windGroup, walls);
	
	//Wind acceleration & world wrap
	windDirection = (breezeRotationSpeed * game.time.time) % (2*Math.PI);//  What direction teh  wind is pointing
	windPhase = (breezeBackAndForthSpeed * game.time.time) % (2*Math.PI);//  The bakc and worth sway of wind

	let windSpeed = Math.sin(windPhase) * breezeForce;
	
	windGroup.forEach(
		function(particle) {
			particle.body.velocity.x += Math.cos(windDirection) * windSpeed;
			particle.body.velocity.y += Math.sin(windDirection) * windSpeed;
		
			game.world.wrap(particle);
		}, this, true, null);
*/

	//Updating things
	players.forEach(function(element, index, array){
		element.update();
		
		//BEGIN DEBUG CONTROLS
		if(index != 0 && element.gameObject.alive)
		{
			element.Velocity = new Phaser.Point((game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPURIGHT)-game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPULEFT))*300,
						   (game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUDOWN)-game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUUP))*300);
						   
			if(game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFERIGHT) || game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFELEFT) || game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFEDOWN) || game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFEUP))
			{
				let knifeVelPoint = new Phaser.Point((game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFERIGHT)-game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFELEFT)),
						   (game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFEDOWN)-game.input.keyboard.isDown(MOVEMENT.DEBUGKEY_CPUKNIFEUP)));
				knifeVelPoint.setMagnitude(800);
				element.throwKnife(knifeVelPoint);
			}
		}
		//END DEBUG CONTROLS
	});
	
	//HUD text
	displayHandler.update();
}

function throwKnife(player, posPoint, velPoint)
{
	player.knife = game.add.sprite(posPoint.x, posPoint.y, 'wallSprite');
	game.physics.enable(player.knife);
	player.knife.checkWorldBounds = true;
	player.knife.outOfBoundsKill = true;
	player.knife.body.immovable = true;
	player.knife.scale.setTo(1/5, 1/5);
	
	player.knife.body.center = posPoint;
	player.knife.body.velocity = velPoint;
}

class GameCharacter
{
	/*
	Member variables:
		name
		knife
		gameObject
		score
	*/
	
	constructor(name)
	{
		GameCharacter.respawnCharacter(this);
		this.knife = null;
		this.name = name;
	}
	
	update()
	{
		game.physics.arcade.collide(this.gameObject, walls);
		
		for(let i = 0; i < players.length && players[i] != this; i++)
		{
			game.physics.arcade.collide(this.gameObject, players[i].gameObject);
		}
		
		if(this.knife != null)
		{
			if(this.knife.alive)
			{
				game.physics.arcade.collide(this.knife, windGroup); //Todo: Consider replacing with overlap function or playing with mass values.
				
				if(game.physics.arcade.overlap(this.knife, walls)) //Knife cutting functions are to be handled either serverside or clientside - these overlap tests are just for looks and might be changed later.
				{
					this.knife.destroy();
					this.knife = null;
				}
				else
				{
					for(let i = 0; i < players.length; i++)
					{
						if(players[i] != this && game.physics.arcade.overlap(this.knife, players[i].gameObject))
						{
							players[i].killCharacter(this.name);
							this.knife.destroy();
							this.knife = null;
							this.score ++;
							break;
						}
					}
				}
			}
			else
			{
				this.knife = null;
			}
		}
	}
	
	killCharacter(killerName)
	{
		this.gameObject.destroy();
		
		const timeBeforeRespawn = 3250; //measured in ms
		setTimeout(GameCharacter.respawnCharacter, timeBeforeRespawn, this);
		
		displayHandler.addNotification(killerName+" KILLED "+this.name);
	}
	
	static respawnCharacter(charToRespawn)
	{
		let newPosX = 0;
		let newPosY = 0;
		//Keeping these as variables seems like a bad idea, but it lets us run the calculations before spawning a player gameobject.
		//We should be fine as long as player GOs keep their size consistent.
		const charWidth = 50;
		const charHeight = 50;
		
		let isValidPos = false;
		do
		{
			newPosX = Math.random()*game.world.width;
			newPosY = Math.random()*game.world.height;
			
			for(let i = 0; i < walls.length; i++)
			{
				let currentWall = walls.getAt(i);
				isValidPos = isValidPos ||
					!(newPosX+charWidth > currentWall.x &&
					newPosX < currentWall.x+currentWall.width &&
					newPosY+charHeight > currentWall.y &&
					newPosY < currentWall.y+currentWall.height);
			}
		}while(!isValidPos)
		
		charToRespawn.gameObject = game.add.sprite(newPosX, newPosY, 'playerSprite');
		game.physics.enable(charToRespawn.gameObject);
		charToRespawn.gameObject.body.collideWorldBounds = true;
		charToRespawn.score = 0;
	}
	
	throwKnife(vel)
	{
		//Might cause sync issues - reexamine later.
		if(!this.knife)
		{
			throwKnife(this, this.gameObject.body.center, vel);
		}
	}
	
	
	get Velocity(){return this.gameObject.body.velocity;}
	set Velocity(velPoint) //should be Phaser.Point
	{
		this.gameObject.body.velocity = velPoint;
	}
	get Position(){return this.gameObject.body.position;}
	set Position(posPoint) //should be Phaser.Point
	{
		this.gameObject.body.position = posPoint;
	}
	get Score() {return this.score;}
	set Score(num)
	{
		this.score = num;
	}
	get Name(){return this.name;}
}

class LocalPlayer extends GameCharacter
{
	/*
	New Member Variables:
		moveSpeed
	*/
	constructor(name)
	{
		super(name);
		this.moveSpeed = 300;
		game.camera.follow(this.gameObject);
		game.input.onDown.add(this.throwKnifeAtPointer, this);
	}

	update()
	{
		super.update();
		if(this.gameObject.alive)
		{
			this.Velocity = new Phaser.Point((game.input.keyboard.isDown(MOVEMENT.RIGHT)-game.input.keyboard.isDown(MOVEMENT.LEFT))*this.moveSpeed,
							(game.input.keyboard.isDown(MOVEMENT.DOWN)-game.input.keyboard.isDown(MOVEMENT.UP))*this.moveSpeed);
		}
	}

	throwKnifeAtPointer(pointer)
	{
		if(this.knife) //Safeguarding against null value of knife
		{
			console.log("Error: Trying to throw a knife while one is already out");
			return;
		}

		let knifeVel = new Phaser.Point(pointer.position.x-(this.gameObject.body.center.x-game.camera.position.x), pointer.position.y-(this.gameObject.body.center.y-game.camera.position.y));
		knifeVel.setMagnitude(800);

		throwKnife(this, this.gameObject.body.center, knifeVel);
	}
	
	killCharacter(killerName)
	{
		this.gameObject.destroy();
		
		const timeBeforeRespawn = 3250; //measured in ms
		setTimeout(LocalPlayer.respawnCharacter, timeBeforeRespawn, this);
		
		displayHandler.addNotification(killerName+" KILLED "+this.name);
		for(let i = 1; i <= timeBeforeRespawn/1000; i++)
		{
			setTimeout(function(){displayHandler.addNotification("RESPAWNING IN "+i+"...");}, timeBeforeRespawn-i*1000, this);
		}
	}
	
	static respawnCharacter(charToRespawn)
	{
		GameCharacter.respawnCharacter(charToRespawn);
		game.camera.follow(charToRespawn.gameObject);
	}
}

//This is probably unimportant enough to stay as a function-class
function HUD()
{
	this.playerStatusText;
	this.fpsText;
	this.eventLogText;
	
	this.eventStringArray;
	
	this.init = function()
	{
		this.playerStatusText = game.add.text(7, 10, "");
		this.playerStatusText.fixedToCamera = true;
		
		this.fpsText = game.add.text(7, 675, "");
		this.fpsText.fixedToCamera = true;
		
		this.eventStringArray = [];
		this.eventLogText = game.add.text(game.camera.width/2, 10, "");
		this.eventLogText.fixedToCamera = true;
		this.eventLogText.wordWrap = true;
		this.eventLogText.wordWrapWidth = game.camera.width/2-7;
	}
	
	this.update = function()
	{
		this.playerStatusText.text = "Score: "+(players[0].score)+"\nThrowable Knife: "+(players[0].knife == null);
	
		this.fpsText.text = game.time.fps+" FPS";
	}
	
	this.addNotification = function(newEventString)
	{
		this.eventStringArray.push(newEventString);
		this.rewriteEventLogText();
		
		const timeBeforeRemoval = 3000; //measured in ms
		setTimeout(this.removeOldestNotification, timeBeforeRemoval, this);
	}
	
	this.removeOldestNotification = function(ObjectToRemove)
	{
		ObjectToRemove.eventStringArray.shift();
		ObjectToRemove.rewriteEventLogText();
	}
	
	this.rewriteEventLogText = function()
	{
		this.eventLogText.text = "";
		for(let i = 0; i < this.eventStringArray.length; i++)
		{
			this.eventLogText.text += this.eventStringArray[i]+"\n";
		}
	}
	
	this.init();
}
