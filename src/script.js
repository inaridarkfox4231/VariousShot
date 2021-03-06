'use strict';

let count = 0;
let all;
let mX = -1;
let mY = -1;
let doubleClickFlag = false;
const bodyColor = [[0, 0, 0]];

function setup() {
	createCanvas(400, 400);
	noStroke();
	all = new master();
	all.initialize();
}

function draw() {
	background(220);
	all.fireCheck();
	all.update();
	all.render();
	all.collisionCheck();
	all.eject();
}

function mouseClicked(){
	mX = mouseX;
	mY = mouseY;
}

function doubleClicked(){
	doubleClickFlag = true;
}

function flagReset(){
	mX = -1;
	mY = -1;
	doubleClickFlag = false;
}

class effect{
	constructor(span){
		this.count = 0;
		this.span = span;
		this.finished = false;
	}
	update(){
		this.count++;
		if(this.count === this.span){ this.finished = true; }
	}
	render(){}
}

// circleVanish: 円を出しながら消える
// blockVanish: ブロックが壊れるように消える
class circleVanish extends effect{
	constructor(span, radius, smallDiam, r, g, b, x, y){
		super(span);
		this.r = radius;
		this.smallDiam = smallDiam;
		this.c = {r:r, g:g, b:b};
		this.p = {x:x, y:y}
	}
	render(){
	  let radius = this.r * Math.pow(this.count / this.span, 2);
	  fill(this.c.r, this.c.g, this.c.b, 255 * (1 - (this.count / this.span)));
	  for(let i = 0; i < 20; i++){
		  let angle = Math.PI * 2 * (i + this.count * 5 / this.span) / 20;
		  ellipse(this.p.x + radius * Math.cos(angle), this.p.y + radius * Math.sin(angle), this.smallDiam, this.smallDiam);
	  }
	}
}

class collider{
	constructor(){
		this.typeName = "";
	}
}

class circleCollider extends collider{
	constructor(x, y, r){
		super();
		this.typeName = "circle";
		this.x = x;
		this.y = y;
		this.r = r;
	}
	update(x, y, r){
		this.x = x;
		this.y = y;
		this.r = r;
	}
}

class player{
  constructor(){
		this.p = {};
		this.c = {};
		this.speed = 0;
		this.direction = 0;
		this.span = 0; // これが0でないと発射されない
		this.shotId = 0;
		this.shotIdMax = 1;
		this.collider = undefined;
	}
	initialize(x, y, speed){
		this.p.x = x;
		this.p.y = y;
		this.c.r = bodyColor[0][0];
		this.c.g = bodyColor[0][1];
		this.c.b = bodyColor[0][2];
		this.speed = speed;
		this.collider = new circleCollider(x, y, 10);
	}
	shotChange(){
		this.shotId = (this.shotId + 1) % this.shotIdMax;
	}
	fire(){
		if(this.span === 0 && mouseIsPressed){ return true; }
		return false;
	}
	setSpan(){
		this.span = 5; // 種類により変える？
	}
	update(){
		if(this.span > 0){ this.span--; }
		if(doubleClickFlag){ this.shotChange(); flagReset(); }
		let d = dist(mouseX, mouseY, this.p.x, this.p.y);
		if(d < 5){ return; }
		let angle = atan2(mouseY - this.p.y, mouseX - this.p.x);
		this.direction = angle;
		if(d < 10){ return; }
		this.p.x += this.speed * Math.cos(angle);
		this.p.y += this.speed * Math.sin(angle);
		if(this.p.x < 10){ this.p.x = 10; }
		if(this.p.y < 10){ this.p.y = 10; }
		if(this.p.x > width - 10){ this.p.x = width - 10; }
		if(this.p.y > height - 10){ this.p.y = height - 10; }
		this.collider.update(this.p.x, this.p.y, 10);
	}
	render(){
		fill(this.c.r, this.c.g, this.c.b, 100);
		ellipse(this.p.x, this.p.y, 20, 20);
		fill(this.c.r, this.c.g, this.c.b);
		ellipse(this.p.x, this.p.y, 10, 10);
		fill(0);
		stroke(5);
		let _dir = this.direction;
		let diffX = [25 * Math.cos(_dir), 15 * Math.cos(_dir + Math.PI * 5 / 6), 15 * Math.cos(_dir + Math.PI * 7 / 6)];
		let diffY = [25 * Math.sin(_dir), 15 * Math.sin(_dir + Math.PI * 5 / 6), 15 * Math.sin(_dir + Math.PI * 7 / 6)];
		line(this.p.x - diffX[0], this.p.y - diffY[0], this.p.x + diffX[0], this.p.y + diffY[0]);
		line(this.p.x + diffX[0], this.p.y + diffY[0], this.p.x + diffX[0] + diffX[1], this.p.y + diffY[0] + diffY[1]);
		line(this.p.x + diffX[0], this.p.y + diffY[0], this.p.x + diffX[0] + diffX[2], this.p.y + diffY[0] + diffY[2]);
		noStroke();
	}
}

class bullet{
	constructor(){
		this.damage = 0;
		this.c = {};
		this.p = {};
		this.v = {};
		this.diam = 0;
		this.alive = true;
		this.collider = undefined;
	}
	initialize(damage, x, y, vx, vy, diam, r, g, b){
		this.damage = damage;
		this.p.x = x;
		this.p.y = y;
		this.v.x = vx;
		this.v.y = vy;
		this.diam = diam;
		this.c.r = r;
		this.c.g = g;
		this.c.b = b;
		this.collider = new circleCollider(x, y, diam / 2);
	}
	eject(){
		this.alive = false;
	}
	updateMain(){
		return;
	}
	update(){
		if(!this.alive){ return; }
		this.updateMain();
		this.p.x += this.v.x;
		this.p.y += this.v.y;
		this.collider.update(this.p.x, this.p.y, this.diam / 2);
		if(this.p.x < this.diam / 2 || this.p.y < this.diam / 2 || this.p.x > width - this.diam / 2 || this.p.y > height - this.diam / 2){
			this.eject();
		}
	}
	render(){
		fill(this.c.r, this.c.g, this.c.b);
		ellipse(this.p.x, this.p.y, this.diam, this.diam);
	}
	hit(_enemy){
		this.alive = false;
	}
}

class straight extends bullet{
	constructor(ax, ay){
		super();
		this.a = {x:ax, y:ay};
	}
	updateMain(){
		this.v.x += this.a.x;
		this.v.y += this.a.y;
	}
}

// ある方向に対して垂直な成分が一定時間あとで消える弾丸
// 時間が経つと決められた方向のvになるということで時間制御が要るわね
class bendBullet extends bullet{
	constructor(mainVx, mainVy, limit){
		super();
		this.mainV = {x:mainVx, y:mainVy};
		this.count = 0;
		this.limit = limit;
	}
	updateMain(){
		if(this.count === this.limit){ return; }
		this.count++;
		if(this.count === this.limit){
			this.v.x = this.mainV.x;
			this.v.y = this.mainV.y;
		}
	}
}

class enemy{
	constructor(){
		this.hp = 0;
		this.p = {};
		this.count = 0;
		this.visible = false;
		this.alive = true;
		this.collider = undefined;
	}
	appear(){}
	update(){}
	render(){}
	hit(_bullet){}
}

class simpleEnemy extends enemy{
	constructor(){
		super();
		this.diam = 0;
		this.c = {};
	}
	initialize(hp, x, y, diam, r, g, b){
		this.hp = hp;
		this.p.x = x;
		this.p.y = y;
		this.diam = diam;
		this.c = {r:r, g:g, b:b};
		this.collider = new circleCollider(x, y, diam / 2);
	}
	appear(){
		fill(this.c.r, this.c.g, this.c.b, this.count * 2);
		ellipse(this.p.x, this.p.y, this.diam, this.diam);
		this.count++;
		if(this.count > 128){ this.count = 0; this.visible = true; }
	}
	update(){
		if(!this.visible || !this.alive){ return; }
	}
	render(){
		if(this.alive && !this.visible){ this.appear(); return; }
		fill(this.c.r, this.c.g, this.c.b);
		ellipse(this.p.x, this.p.y, this.diam, this.diam);
	}
	hit(_bullet){
		this.hp -= _bullet.damage;
		if(this.hp <= 0){ this.eject(); return; }
		// ブリンク処理
	}
	eject(){
		this.alive = false;
	}
}

class master{
	constructor(){
		this.player = new player();
		this.effectArray = [];
		this.bulletArray = [];
		this.enemyArray = [];
		this.regist();
	}
	initialize(){
		this.player.initialize(20, 380, 2);
	}
	regist(){
		//let ef1 = new circleVanish(60, 60, 10, 255, 0, 0, 200, 200);
		//let ef2 = new circleVanish(60, 80, 10, 0, 255, 0, 100, 200);
		//let ef3 = new circleVanish(60, 90, 10, 0, 0, 255, 300, 200);
		//this.effectArray.push(...[ef1, ef2, ef3]);
		for(let x = 100; x <= 300; x += 40){
			for(let y = 100; y <= 300; y += 40){
				let e = new simpleEnemy();
				e.initialize(15, x, y, 20, 255, x - 100, y - 100);
				this.enemyArray.push(e);
			}
		}
		//let e1 = new simpleEnemy();
		//let e2 = new simpleEnemy();
		//e1.initialize(15, 200, 100, 20, 0, 0, 255);
		//e2.initialize(15, 200, 200, 20, 255, 0, 0);
		//this.enemyArray.push(...[e1, e2]);
	}
	createBullet(id, p, c, angle){
		switch(id){
			case 0:
		    let b = new bullet();
		    b.initialize(5, p.x, p.y, 5 * Math.cos(angle), 5 * Math.sin(angle), 10, c.r, c.g, c.b);
		    this.bulletArray.push(b);
				break;
			case 1:
				// 5WAY
				let bArray = this.get5WayBullets(p, c, angle);
				this.bulletArray.push(...bArray);
				break;
		}
	}
	get5WayBullets(p, c, angle){
	}
	fireCheck(){
		// 弾丸発射はここで
		let pl = this.player;
		if(pl.fire()){
			this.createBullet(pl.shotId, pl.p, pl.c, pl.direction);
			this.player.setSpan();
		}
	}
	update(){
		allUpdate([[this.player], this.effectArray, this.bulletArray, this.enemyArray]);
	}
	render(){
		allRender([[this.player], this.effectArray, this.bulletArray, this.enemyArray]);
	}
  collisionCheck(){
		for(let i = 0; i < this.bulletArray.length; i++){
			let b = this.bulletArray[i];
			if(!b.alive){ continue; }
			for(let k = 0; k < this.enemyArray.length; k++){
				let e = this.enemyArray[k];
				if(!e.alive){ continue; }
				if(collideCircleAndCircle(b.collider, e.collider)){
					b.hit();
					e.hit(b);
					break;
				}
			}
		}
	}
	eject(){
		for(let i = 0; i < this.effectArray.length; i++){
			let ef = this.effectArray[i];
			if(ef.finished){ this.effectArray.splice(i, 1); }
		}
		for(let i = 0; i < this.bulletArray.length; i++){
			let b = this.bulletArray[i];
			if(!b.alive){ this.bulletArray.splice(i, 1); }
		}
		for(let i = 0; i < this.enemyArray.length; i++){
			let e = this.enemyArray[i];
			if(!e.alive){
				this.effectArray.push(new circleVanish(60, 60, 10, e.c.r, e.c.g, e.c.b, e.p.x, e.p.y));
				this.enemyArray.splice(i, 1);
			}
		}
	}
}

function collideCircleAndCircle(_collider1, _collider2){
	if(dist(_collider1.x, _collider1.y, _collider2.x, _collider2.y) < _collider1.r + _collider2.r){
		return true;
	}
	return false;
}

function allUpdate(arrayOfArray){
	arrayOfArray.forEach((array) => {array.forEach((obj) => { obj.update(); })})
}

function allRender(arrayOfArray){
	arrayOfArray.forEach((array) => {array.forEach((obj) => { obj.render(); })})
}

// mouseがdownでかつfireなら発射されるイメージ
// doubleClickでshotChange？

// 3WAY
// 押してる時間でショットが変わるやつはゲージを用意する感じで（ぐるーって）
// そこらへんもshotIdで制御、できるでしょ。

// effectは衝突判定で出すべき
