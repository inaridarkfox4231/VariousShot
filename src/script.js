"use strict";

let all;
let mX = 0;
let mY = 0;
const bodyColor = [[0, 0, 0], [27, 139, 61]];
const spanArray = [5, 10]; // span関係ないところは-1で補間
let doubleClickFlag = false;

function setup(){
	createCanvas(640, 480);
	all = new master();
	all.inputState();
}

function draw(){
	all.update();
	all.render();
}

function mouseClicked(){
	mX = mouseX;
	mY = mouseY;
}

function doubleClicked(){
	doubleClickFlag = true;
}

function flagReset(){
	mX = -100;
	mY = -100;
	doubleClickFlag = false;
}

class master{
	constructor(){
		this.stateArray = [];
		this.stateIndex = 0;
		this.currentState = undefined;
	}
	inputState(){
		this.stateArray.push(...[new title(), new select(), new play()]);
		this.currentState = this.stateArray[this.stateIndex];
	}
	shiftIndex(n){
		this.stateIndex += n;
		this.currentState = this.stateArray[this.stateIndex];
	}
	update(){
		this.currentState.update(this);
	}
	render(){
		this.currentState.render(this);
	}
}

// 数を返す(0とか1とか）
// たとえば0を返すうちはstateは変化しない
class state{
	constructor(){}
	update(_master){}
	render(_master){}
}

class title extends state{
	constructor(){
		super();
	}
	update(_master){
		if(mX > 220 && mX < 420 && mY > 300 && mY < 400){
			_master.shiftIndex(1);
			flagReset();
		}
	}
	render(_master){
		background(200, 200, 255);
		fill(0);
		textSize(40);
		text('title', 50, 50);
		fill(0, 0, 255);
		rect(220, 300, 200, 100);
	}
}
class select extends state{
	constructor(){
		super();
	}
	update(_master){
		if(mX > 100 && mX < 540 && mY > 200 && mY < 280){
		  if(mX > 220 && mX < 260){ return; }
			if(mX > 380 && mX < 420){ return; }
			let lv = Math.floor((mX - 80) / 160);
			_master.shiftIndex(1);
			_master.currentState.setLevel(lv);
			flagReset();
		}
	}
	render(_master){
		background(220);
		fill(0);
		textSize(40);
		text("select level", 50, 50);
		fill(160);
		rect(100, 200, 120, 80);
		fill(80);
		rect(260, 200, 120, 80);
		fill(0);
		rect(420, 200, 120, 80);
	}
}

class play extends state{
	constructor(){
		super();
		this.player = new player(50, 320, 5, 100);
		this.enemyArray = []; // aliveでないものを排除
		this.playerBulletArray = [];
		this.enemyBulletArray = [];
		this.appearEffectArray = [];
		this.vanishEffectArray = [];
		this.generator = new enemyGenerator();
		this.lv = -1;
	}
	reset(){
		this.player.initialize(50, 320, 5, 100);
		this.enemyArray = [];
		this.playerBulletArray = [];
		this.enemyBulletArray = [];
		this.appearEffectArray = [];
		this.vanishEffectArray = []
		this.interval = 120;
		this.generator.reset();
	}
	setLevel(newLv){
		this.lv = newLv;
		// レベルに応じた敵出現シークエンス
    // ゆくゆくはjsonに落とすつもり
		let array = [createGenerateWait(120), createSimpleGenerate([0], [{x:600, y:100}]), createGenerateWait(40), createGenerateLoop(2, 5)];
		array.push(...[createGenerateWait(120), createSimpleGenerate([0], [{x:600, y:380}]), createGenerateWait(40), createGenerateLoop(2, 5)]);
		this.generator.setCommand(array);
	}
	update(_master){
		if(mX > 0 && mX < 40 && mY > 0 && mY < 40){
			this.reset();
			_master.shiftIndex(-1);
			flagReset();
		}
		this.generator.update();
		this.player.update();
		this.enemyArray.forEach((e) => { e.update(); })
		this.playerBulletArray.forEach((b) => { b.update(); })
		this.enemyBulletArray.forEach((b) => { b.update(); })
		this.appearEffectArray.forEach((ef) => { ef.update(); })
		this.vanishEffectArray.forEach((ef) => { ef.update(); })
		this.collisionCheck();
		this.charge();
		this.eject();
	}
	collisionCheck(){
		// playerとenemy
	  for(let i = 0; i < this.enemyArray.length; i++){
			let e = this.enemyArray[i];
			if(!e.alive){ continue; }
			if(collideObjects(this.player.collider, e.collider)){ this.player.hit(e); e.hit(this.player); }
		}
		// playerBulletとenemy
    for(let k = 0; k < this.playerBulletArray.length; k++){
			let b = this.playerBulletArray[k];
			if(!b.alive){ continue; }
			for(let i = 0; i < this.enemyArray.length; i++){
				let e = this.enemyArray[i];
				if(!e.alive){ continue; }
				if(collideObjects(b.collider, e.collider)){ b.hit(e); e.hit(b); }
			}
		}
		// enemyBulletとplayer
		for(let h = 0; h < this.enemyBulletArray.length; h++){
			let b = this.enemyBulletArray[h];
			if(!b.alive){ continue; }
			if(collideObjects(this.player.collider, b.collider)){ this.player.hit(b); b.hit(this.player); }
		}
		// いずれ線型4分木（quadTree）で書き直す
	}
	render(_master){
		background(220);
		fill(0);
		textSize(40);
		text("level " + this.lv + ", playerLife " + this.player.life, 100, 100);
		text("bullet " + (this.enemyBulletArray.length + this.playerBulletArray.length), 100, 200);
		fill(255, 0, 0);
		rect(0, 0, 40, 40);
		this.player.render();
		this.enemyArray.forEach((e) => { e.render(); })
		this.playerBulletArray.forEach((b) => { b.render(); })
		this.enemyBulletArray.forEach((b) => { b.render(); })
		this.appearEffectArray.forEach((ef) => { ef.render(); })
		this.vanishEffectArray.forEach((ef) => { ef.render(); })
	}
	charge(){
		this.generator.charge(this.appearEffectArray); // ここでエフェクトも同時に発生させてエフェクトが終わり次第・・みたいな。
		// エフェクトにenemyを持たせて排除するときにenemyを出させるとか。
		// つまりenemyをチャージする代わりにenemy持ちのエフェクトをチャージする。
		// プレイヤーについてはやられたらエフェクト、でいいよ。
		this.player.charge(this.playerBulletArray);
		this.enemyArray.forEach((e) => { e.charge(this.enemyBulletArray); })
	}
	eject(){
		for(let i = 0; i < this.enemyArray.length; i++){
			let e = this.enemyArray[i];
			if(!e.alive){
				this.vanishEffectArray.push(new simpleVanish(60, e));
				this.enemyArray.splice(i, 1);
			}
		}
		for(let i = 0; i < this.playerBulletArray.length; i++){
			let b = this.playerBulletArray[i];
			if(!b.alive){ this.playerBulletArray.splice(i, 1); }
		}
		for(let i = 0; i < this.enemyBulletArray.length; i++){
			let b = this.enemyBulletArray[i];
			if(!b.alive){ this.enemyBulletArray.splice(i, 1); }
		}
		for(let i = 0; i < this.appearEffectArray.length; i++){
			let ef = this.appearEffectArray[i];
			if(ef.finished){
				this.enemyArray.push(ef.enemy);
				this.appearEffectArray.splice(i, 1);
			}
		}
		for(let i = 0; i < this.vanishEffectArray.length; i++){
			let ef = this.vanishEffectArray[i];
			if(ef.finished){
				this.vanishEffectArray.splice(i, 1);
			}
		}
	}
}

// collider.
class collider{
	constructor(id){
		this.typeName = "";
		this.id = id; // 識別番号
	}
	setId(newId){
		this.id = newId;
	}
}

class circleCollider extends collider{
	constructor(id, x, y, r){
		super(id);
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

// x, yは左上の座標。
// colliderのパラメータとしては、中心の座標(x, y)及び横の長さの半分wと縦の長さの半分hという感じにする
class rectCollider extends collider{
	constructor(id, x, y, w, h){
		super(id);
		this.typeName = 'rect';
		this.x = x + (w / 2);
		this.y = y + (h / 2);
		this.w = w / 2;
		this.h = h / 2;
	}
	update(x, y, w, h){
		this.x = x + (w / 2);
		this.y = y + (h / 2);
		this.w = w / 2;
		this.h = h / 2;
	}
}

function collideObjects(_collider1, _collider2){
	if(_collider1.typeName === 'circle' && _collider2.typeName === 'circle'){
		if(dist(_collider1.x, _collider1.y, _collider2.x, _collider2.y) < _collider1.r + _collider2.r){
			return true;
		}
	}else if(_collider1.typeName === 'rect' && _collider2.typeName === 'rect'){
		let f1 = (abs(_collider1.x - _collider2.x) < _collider1.w + _collider2.w);
		let f2 = (abs(_collider1.y - _collider2.y) < _collider1.h + _collider2.h);
		if(f1 && f2){ return true; }
	}
	return false;
}

// player側からmasterのbulletArrayに放り込む？
class player{
	constructor(x, y, speed, life){
		this.x = x;
		this.y = y;
		this.c = {r:0,g:0,b:0};
		this.life = life;
		this.maxLife = life;
		this.alive = true;
		this.speed = speed;
		this.shotId = 0;
		this.maxShotId = 1;
		this.span = 0; // 射出間隔
		this.blink = 60; // ブリンク(正の時無敵）
		this.collider = new circleCollider(0, x, y, 5);
	}
	initialize(x, y, speed, life){
		this.x = x;
		this.y = y;
		this.speed = speed;
		this.life = life;
		this.maxLife = life;
		this.alive = true;
		this.shotId = 0;
		this.maxShotId = 1;
		this.span = 0;
		this.c = {r:0, g:0, b:0};
		this.blink = 60;
	}
	shotChange(){
		this.shotId = (this.shotId + 1) % this.maxShotId;
		let _color = bodyColor[this.shotId];
		this.c = {r:_color[0], g:_color[1], b:_color[2]};
	}
	charge(array){
		// arrayにbulletをぶちこむ（複数の場合あり）
		if(!mouseIsPressed || this.span > 0){ return; }
		let b = getBullet(this);
		b.forEach((eachB) => {eachB.collider.setId(2);})
		array.push(...b);
		this.span = spanArray[this.shotId];
	}
	move(){
		let d = dist(this.x, this.y, mouseX, mouseY);
		if(d < 10){ return; }
		let angle = atan2(mouseY - this.y, mouseX - this.x);
		this.x += this.speed * Math.cos(angle);
		this.y += this.speed * Math.sin(angle);
		this.boundCheck();
	}
	update(){
		if(!this.alive){ return; }
		// spanが正なら減らす
		if(this.span > 0){ this.span--; }
		if(this.blink > 0){ this.blink--; }
		if(doubleClickFlag){ this.shotChange(); flagReset(); }
		this.move();
		this.collider.update(this.x, this.y, 10);
	}
	boundCheck(){
		if(this.x < 10){ this.x = 10; }
		else if(this.x > width - 10){ this.x = width - 10; }
		if(this.y < 10){ this.y = 10; }
		else if(this.y > height - 10){ this.y = height - 10; }
	}
	render(){
		if(!this.alive){ return; }
		if(this.blink > 0 && Math.floor(this.blink / 2) % 2 === 0){ return; }
		noStroke();
    fill(this.c.r, this.c.g, this.c.b, 100);
		ellipse(this.x, this.y, 20, 20);
		fill(this.c.r, this.c.g, this.c.b);
		ellipse(this.x, this.y, 10, 10);
	}
	hit(obj){
		// objはenemy又はenemyBullet. colliderのidで判定する。
		if(this.blink > 0){ return; }
		let id = obj.collider.id;
		if(id === 1){ this.life -= 10; }
		else if(id === 3){
			this.life -= obj.damage;
		}
		if(this.life > 0){ this.blink = 30; return; }
		this.life = 0;
		this.alive = false;
	}
}

// うごくもの
class mover{
	constructor(x, y, diam, moveArray, shotArray, r, g, b){
		this.mt = 0; // moveArray用の制御変数
		this.mLoop = 0; // moveArray用のループカウンタ
		this.st = 0; // shotArray用の制御変数
		this.sLoop = 0; // shotArray用のループカウンタ
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
		this.c = {r:r, g:g, b:b};
		this.diam = diam;
		this.moveArray = moveArray;
		this.moveIndex = 0;
		this.currentMove = moveArray[0];
		this.shotArray = shotArray;
		this.shotIndex = 0;
		this.currentShot = undefined;
		if(shotArray.length > 0){ this.currentShot = shotArray[0]; }
		this.shotId = -1;
		this.fire = false;
		this.alive = true;
		this.collider = new circleCollider(-1, x, y, diam / 2);
	}
	charge(array){
    if(!this.fire){ return; }
		let b = getBullet(this);
		b.forEach((eachB) => { eachB.collider.setId(3); })
		array.push(...b);
		this.fire = false;
	}
	setShot(newShotId){
		this.shotId = newShotId;
		this.fire = true;
	}
	rotateDirection(deg){
		let angle = deg * Math.PI / 180;
		let _vx = this.vx;
		let _vy = this.vy;
		this.vx = _vx * Math.cos(angle) - _vy * Math.sin(angle);
		this.vy = _vy * Math.cos(angle) + _vx * Math.sin(angle);
	}
	eject(){
		this.alive = false;
	}
	boundCheck(){
		if(this.x < this.diam / 2 || this.x > width - this.diam / 2 || this.y < this.diam / 2 || this.y > height - this.diam / 2){
			this.eject();
		}
	}
	act(){
		this.currentMove(this);
		if(this.currentShot !== undefined){ this.currentShot(this); }
	}
	shiftMoveIndex(n){
		this.moveIndex += n;
		this.currentMove = this.moveArray[this.moveIndex];
	}
	shiftShotIndex(n){
		this.shotIndex += n;
		this.currentShot = this.shotArray[this.shotIndex];
	}
	update(){
		this.act();
		this.boundCheck();
		this.collider.update(this.x, this.y, this.diam / 2);
	}
	render(){
	  if(!this.alive){ return; }
		fill(this.c.r, this.c.g, this.c.b);
		ellipse(this.x, this.y, this.diam, this.diam);
	}
}

// enemy側からmasterのenemyBulletArrayに放り込むか
class enemy extends mover{
	constructor(x, y, diam, moveArray, shotArray, r, g, b, life){
		super(x, y, diam, moveArray, shotArray, r ,g, b);
		this.life = life;
		this.maxLife = life;
	}
	hit(obj){
		// 0か2で反応する
		if(obj.collider.id === 0){ return; }
		//console.log("hit444");
		this.life -= obj.damage;
		if(this.life > 0){ return; }
		this.life = 0;
		this.alive = false;
	}
}

class bullet extends mover{
  constructor(x, y, diam, moveArray, shotArray, r, g, b, damage){
		super(x, y, diam, moveArray, shotArray, r, g, b);
		this.damage = damage;
	}
	hit(obj){
		//console.log("hit " + this.collider.id);
		this.alive = false;
	}
}

function createSetV(vx, vy){ return (m) => {m.vx = vx; m.vy = vy; m.shiftMoveIndex(1); }; }
function straight(m){ m.x += m.vx; m.y += m.vy; }
function createStraightWithBound(a, b, c){ return (m) => {
	m.x += m.vx; m.y += m.vy;
	if(a * m.x + b * m.y > c){ m.shiftMoveIndex(1); }
}}
function createRotation(deg){ return (m) => { m.rotateDirection(deg); }; }
function createRotationWithLimit(deg, limit){
	return (m) => {
		m.mt++;
		m.rotateDirection(deg);
		m.x += m.vx; m.y += m.vy;
		if(m.mt < limit){ return; }
		m.mt = 0; m.shiftMoveIndex(1);
	}
}
function createBack(n){ return (m) => { m.shiftMoveIndex(-n); } }
// n個戻すか、先に進めるか
function createMoveLoop(n, limit){ return (m) => {
	m.mLoop++;
	if(m.mLoop < limit || limit < 0){ m.shiftMoveIndex(-n); } // limitに-1を指定すると無限ループ
	else{ m.mLoop = 0; m.shiftMoveIndex(1);}
} }
function createMoveWait(limit){ return (m) => {
	m.mt++;
	if(m.mt < limit){ return; }
	m.mt = 0; m.shiftMoveIndex(1);
} } // limitだけ間を置く

function createSetShot(id){
	return (m) => { m.setShot(id); m.shiftShotIndex(1); };
} // ショット設定
function createShotWait(limit){ return (m) => {
	m.st++;
	if(m.st < limit){ return; }
	m.st = 0; m.shiftShotIndex(1);
} } // limitだけ間を置く
function createShotLoop(n, limit){ return (m) => {
	m.sLoop++;
	if(m.sLoop < limit || limit < 0){ m.shiftShotIndex(-n); } // limitに-1を指定すると無限ループ
	else{ m.sLoop = 0; m.shiftShotIndex(1); }
} }

// (x, y)からプレイヤーへの方向
function getPlayerDirection(x, y){
	let p = all.currentState.player;
	return atan2(p.y - y, p.x - x);
}

// 以下はshotパラメータをいじるための関数
function getEnemy(id, x, y){
	// idによって異なるenemyを作るうえでのデータを返す感じ
	switch(id){
		case 0:
			let mArray = [createSetV(-2, 0), straight];
			let sArray = [createSetShot(32), createShotWait(30), createShotLoop(2, 5)];
			return new enemy(x, y, 20, mArray, sArray, 255, 201, 14, 15); // lifeは15.
	}
}

function getBullet(_obj){
	// idによって異なるbulletを作るうえでのデータを返す感じ
	let id = _obj.shotId;
	switch(id){
		case 0:
			// 直進
			return getStraight(_obj);
		case 32:
			// 自機誘導
			return toPlayer(_obj);
	}
}

function getStraight(_obj){
	let mArray = [createSetV(8, 0), straight];
	return [new bullet(_obj.x, _obj.y, 10, mArray, [], 0, 0, 0, 5)]; // ダメージは5
}

function toPlayer(_obj){
	let dir = getPlayerDirection(_obj.x, _obj.y);
	let vx = 3 * Math.cos(dir);
	let vy = 3 * Math.sin(dir);
	let mArray = [createSetV(vx, vy), straight];
	return [new bullet(_obj.x, _obj.y, 10, mArray, [], 163, 73, 164, 5)]; // ダメージは5
}

// てきをつくる
// 1:上半分から5匹
// 間隔
// 2:下半分から5匹
// 間隔
// 縦に3匹並んで出現が高さランダムで5回
// 間隔
// 以上、攻撃はすべて一定間隔で自機誘導弾
// 上と下で1匹ずつゆっくり出てきてこっちに扇状に5回ずつ弾を放つ、からの中心経由でクロスするように消える
// 間隔
// 上と下から5匹ずつ出てきてカーブして直進しつつ左に消える感じ
// 間隔

// idArray = [0]なら0だけ、[0, 0]なら0が2匹で別の場所、ランダム、以下略
// ループカウンタとかウェイトは同じように
class enemyGenerator{
  constructor(){
		this.gt = 0; // 制御変数・・この辺はクラスにする？commandで統一できそう。
		this.gLoop = 0; // ループカウンタ
		this.idArray = [];
		this.posArray = [];
		this.commandArray = [];
		this.commandIndex = 0;
		this.currentCommand = undefined;
		this.generate = false;
	}
	reset(){
		this.gt = 0;
		this.gLoop = 0;
		this.idArray = [];
		this.posArray = [];
		this.commandArray = [];
		this.commandIndex = 0;
		this.currentCommand = undefined;
		this.generate = false;
	}
	setCommand(array){
		this.commandArray = array;
		this.currentCommand = array[0];
	}
	setEnemy(idArray, posArray){
		this.idArray = idArray;
		this.posArray = posArray;
		this.generate = true;
	}
	charge(array){
		if(!this.generate){ return; }
		for(let i = 0; i < this.idArray.length; i++){
			let e = getEnemy(this.idArray[i], this.posArray[i].x, this.posArray[i].y);
			e.collider.setId(1);
			array.push(new simpleAppear(60, e));
		}
		this.generate = false;
	}
	act(){
		if(this.currentCommand !== undefined){ this.currentCommand(this); }
	}
	update(){
		this.act();
	}
	shiftIndex(n){
		this.commandIndex += n;
		this.currentCommand = this.commandArray[this.commandIndex];
	}
}

function createSimpleGenerate(idArray, posArray){
	return (g) => { g.setEnemy(idArray, posArray); g.shiftIndex(1); }
}
function createGenerateWait(limit){ return (g) => {
	g.gt++;
	if(g.gt < limit){ return; }
	g.gt = 0; g.shiftIndex(1);
} } // limitだけ間を置く
function createGenerateLoop(n, limit){ return (g) => {
	g.gLoop++;
	if(g.gLoop < limit || limit < 0){ g.shiftIndex(-n); } // limitに-1を指定すると無限ループ
	else{ g.gLoop = 0; g.shiftIndex(1); }
} }

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
}

class simpleAppear extends effect{
	constructor(span, enemy){
		super(span);
		this.enemy = enemy;
	}
	render(){
		let x = this.enemy.x;
		let y = this.enemy.y;
		let c = this.enemy.c;
		let diam = this.enemy.diam;
		fill(c.r, c.g, c.b, 255 * this.count / this.span); // 30くらいを想定
		for(let i = 0; i < 4; i++){
			let angle = Math.PI * 2 * ((12 * i + this.count) / 48);
			let r = diam * 2 * (this.span - this.count) / this.span;
			ellipse(x + r * Math.cos(angle), y + r * Math.sin(angle), diam, diam);
		}
	}
}

class simpleVanish extends effect{
	constructor(span, obj){
		super(span);
		this.x = obj.x;
		this.y = obj.y;
		this.c = obj.c;
		this.diam = obj.diam;
	}
	render(){
	  let radius = this.diam * Math.pow(this.count / this.span, 2) * 2;
	  fill(this.c.r, this.c.g, this.c.b, 255 * (1 - (this.count / this.span)));
	  for(let i = 0; i < 20; i++){
		  let angle = Math.PI * 2 * (i + this.count * 5 / this.span) / 20;
		  ellipse(this.x + radius * Math.cos(angle), this.y + radius * Math.sin(angle), this.diam / 2, this.diam / 2);
	  }
	}
}
