"use strict";

// quadTreeを用いた衝突判定のコードは、
// 古都ことさん（@kfurumiya）のブログ（https://sbfl.net/blog/2017/12/03/javascript-collision/）
// を参考にしました。感謝します。

let all;
let mX = 0;
let mY = 0;
const bodyColor = [[0, 0, 0], [28, 147, 64], [237, 28, 36]];
const spanArray = [5, 8, 10]; // span関係ないところは-1で補間
let doubleClickFlag = false;

// 時間表示の設置。
/*
const timeCounter = document.createElement('div');
document.body.appendChild(timeCounter);
const collisionCounter = document.createElement('div');
document.body.appendChild(collisionCounter);
*/

function setup(){
	createCanvas(640, 480);
	all = new master();
	all.inputState();
}

function draw(){
  //const start = performance.now(); // 時間表示。
	all.update();
	all.render();
	//const end = performance.now();
  //const timeStr = (end - start).toPrecision(4);
  //timeCounter.innerText = `${timeStr}ms`;
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

// ----------------------------------------------------------------------------------- //
// master.

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

// ----------------------------------------------------------------------------------- //
// state関連（play以外）

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

// ----------------------------------------------------------------------------------- //
// play state.

class play extends state{
	constructor(){
		super();
		this.player = new player(50, 320, 5, 100);
		this.enemyArray = []; // activeでないものを排除
		this.bulletArray = [];
		this.effectArray = [];
		this.generator = new enemyGenerator();
		this.lv = -1;
		// 衝突関連。毎回初期化する。
    this._qTree = new linearQuadTreeSpace(width, height, 3);
    this._detector = new collisionDetector();
	}
	reset(){
		this.player.initialize(50, 320, 5, 100);
		this.enemyArray = [];
		this.bulletArray = [];
		this.effectArray = [];
		this.interval = 120;
		this.generator.reset();
	}
	setLevel(newLv){
		this.lv = newLv;
		// レベルに応じた敵出現シークエンス
    // ゆくゆくはjsonに落とすつもり
		let array = [wait(120), simpleGenerate([0], [{x:600, y:100}]), wait(40), shiftLoop(2, 5)];
		array.push(...[wait(120), simpleGenerate([0], [{x:600, y:380}]), wait(40), shiftLoop(2, 5)]);
		array.push(...[wait(120), simpleGenerate(
			[1, 1, 1, 1, 1], [{x:600, y:100}, {x:500, y:170}, {x:600, y:240}, {x:500, y:310}, {x:600, y:380}]
		)]);
		array.push(...[wait(600), simpleGenerate([2, 2], [{x:560, y:120}, {x:560, y:360}])]);
		array.push(...[wait(360), simpleGenerate(
			[0, 1, 1, 0], [{x:560, y:100}, {x:460, y:180}, {x:460, y:300}, {x:560, y:380}]
		), wait(240)]);
		for(let i = 0; i < 10; i++){
			array.push(...[simpleGenerate([0], [{x:560 + random(40), y:60 + random(120)}])]);
			array.push(...[simpleGenerate([0], [{x:560 + random(40), y:420 - random(120)}]), wait(60)]);
		}
		array.push(...[wait(240), simpleGenerate([3, 3], [{x:600, y:120}, {x:600, y:360}])]);
		this.generator.setCommand(array);
	}
	update(_master){
		if(mX > 0 && mX < 40 && mY > 0 && mY < 40){
			this.reset();
			_master.shiftIndex(-1);
			flagReset();
		}
		every([[this.generator, this.player], this.enemyArray, this.bulletArray, this.effectArray], "update");
		this.collisionCheck();
		this.charge();
		this.eject();
	}
	collisionCheck(){
		this._qTree.clear(); // 四分木のクリア
		this._qTree.addActors([[this.player], this.enemyArray, this.bulletArray]);
		this._hitTest();
	}
	_hitTest(currentIndex = 0, objList = []){
		const currentCell = this._qTree.data[currentIndex];

    // 現在のセルの中と、衝突オブジェクトリストとで
    // 当たり判定を取る。
    this._hitTestInCell(currentCell, objList);

    // 次に下位セルを持つか調べる。
    // 下位セルは最大4個なので、i=0から3の決め打ちで良い。
    let hasChildren = false;
    for(let i = 0; i < 4; i++) {
      const nextIndex = currentIndex * 4 + 1 + i;

      // 下位セルがあったら、
      const hasChildCell = (nextIndex < this._qTree.data.length) && (this._qTree.data[nextIndex] !== null);
      hasChildren = hasChildren || hasChildCell;
      if(hasChildCell) {
        // 衝突オブジェクトリストにpushして、
        objList.push(...currentCell);
        // 下位セルで当たり判定を取る。再帰。
        this._hitTest(nextIndex, objList);
      }
    }
    // 終わったら追加したオブジェクトをpopする。
    if(hasChildren) {
      const popNum = currentCell.length;
      for(let i = 0; i < popNum; i++) {
        objList.pop();
      }
    }
  }
	// セルの中の当たり判定を取る。
  // 衝突オブジェクトリストとも取る。
  _hitTestInCell(cell, objList) {
    // セルの中。総当たり。
    const length = cell.length;
    const cellColliderCahce = new Array(length); // globalColliderのためのキャッシュ。
    if(length > 0) { cellColliderCahce[0] = cell[0].collider; }

    for(let i=0; i < length - 1; i++) {
      const obj1 = cell[i];
      const collider1  = cellColliderCahce[i]; // キャッシュから取ってくる。
      for(let j=i+1; j < length; j++) {
        const obj2 = cell[j];

        // キャッシュから取ってくる。
        // ループ初回は直接取得してキャッシュに入れる。
        let collider2;
        if(i === 0) {
          collider2 = obj2.collider;
          cellColliderCahce[j] = collider2;
        } else {
          collider2 = cellColliderCahce[j];
        }
        // Cahceへの代入までスルーしちゃうとまずいみたい
        // ここでobj1, obj2の性質によるバリデーションかけてfalseならcontinue
        if(!this.validation(obj1.collider.id, obj2.collider.id)){ continue; }

        const hit = this._detector.detectCollision(collider1, collider2);

        if(hit) {
          if(obj1.active && obj2.active){
            obj1.hit(obj2);
            obj2.hit(obj1);
          }
        }
      }
    }

    // 衝突オブジェクトリストと。
    const objLength = objList.length;
    const cellLength = cell.length;
    for(let i = 0; i < objLength; i++) {
      const obj = objList[i];
      const collider1 = obj.collider; // 直接取得する。
      for(let j = 0; j < cellLength; j++) {
        const cellObj = cell[j];

        // objとcellobjの性質からバリデーションかけてfalseならcontinue.
        if(!this.validation(obj.collider.id, cellObj.collider.id)){ continue; }

        const collider2 = cellColliderCahce[j]; // キャッシュから取ってくる。
        const hit = this._detector.detectCollision(collider1, collider2);

        if(hit) {
          if(obj.active && cellObj.active){
            obj.hit(cellObj);
            cellObj.hit(obj);
          }
        }
      }
    }
  }
	validation(id1, id2){
		// 0:player, 1:enemy, 2:playerBullet, 3:enemyBullet.
		if(id1 === 0 && id2 === 1){ return true; }
		if(id1 === 1 && id2 === 0){ return true; }
		if(id1 === 1 && id2 === 2){ return true; }
		if(id1 === 2 && id2 === 1){ return true; }
		if(id1 === 0 && id2 === 3){ return true; }
		if(id1 === 3 && id2 === 0){ return true; }
		return false;
	}
	render(_master){
		background(220);
		fill(0);
		textSize(40);
		text("level " + this.lv + ", playerLife " + this.player.life, 100, 100);
		text("bullet " + (this.bulletArray.length), 100, 200);
		fill(255, 0, 0);
		rect(0, 0, 40, 40);
		every([[this.player], this.enemyArray, this.bulletArray, this.effectArray], "render");
	}
	charge(){
		this.generator.charge(this.effectArray); // ここでエフェクトも同時に発生させてエフェクトが終わり次第・・みたいな。
		// エフェクトにenemyを持たせて排除するときにenemyを出させるとか。
		// つまりenemyをチャージする代わりにenemy持ちのエフェクトをチャージする。
		// プレイヤーについてはやられたらエフェクト、でいいよ。
		this.player.charge(this.bulletArray);
		this.enemyArray.forEach((e) => { e.charge(this.bulletArray); })
	}
	eject(){
		for(let i = 0; i < this.enemyArray.length; i++){
			let e = this.enemyArray[i];
			if(!e.active){
				this.effectArray.push(new simpleVanish(60, e));
				this.enemyArray.splice(i, 1);
			}
		}
		for(let i = 0; i < this.bulletArray.length; i++){
			let b = this.bulletArray[i];
			if(!b.active){ this.bulletArray.splice(i, 1); }
		}
		for(let i = 0; i < this.effectArray.length; i++){
			let ef = this.effectArray[i];
			if(ef.finished){
				if(ef.typeName === "appear"){ this.enemyArray.push(ef.enemy); }
				this.effectArray.splice(i, 1);
			}
		}
	}
}

// ----------------------------------------------------------------------------------- //
// collider関連。

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
	get left(){ return this.x - this.r; }
	get top(){ return this.x + this.r; }
	get top(){ return this.y - this.r; }
	get bottom(){ return this.y + this.r; }
	update(x, y, r){
		this.x = x;
		this.y = y;
		this.r = r;
	}
}

// x, yは中心、wとhは横幅の半分、縦幅の半分
class rectCollider extends collider{
	constructor(id, x, y, w, h){
		super(id);
		this.typeName = 'rect';
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
	}
	get left(){ return this.x - this.w; }
	get top(){ return this.x + this.w; }
	get top(){ return this.y - this.h; }
	get bottom(){ return this.y + this.h; }
	update(x, y, w, h){
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
	}
}

class collisionDetector {
  // 当たり判定を検出する。
  detectCollision(collider1, collider2) {
    if(collider1.typeName == 'rect' && collider2.typeName == 'rect'){
      return this.detectRectangleCollision(collider1, collider2);
    }
    if(collider1.typeName == 'circle' && collider2.typeName == 'circle'){
      return this.detectCircleCollision(collider1, collider2);
    }
		return false;
  }
  // 矩形同士の当たり判定を検出する。
  detectRectangleCollision(rect1, rect2){
    let flag1 = (abs(rect1.x - rect2.x) < rect1.w + rect2.w);
		let flag2 = (abs(rect1.y - rect2.y) < rect1.h + rect2.h);
		return (flag1 && flag2);
  }
  // 円形同士
  detectCircleCollision(circle1, circle2){
    const distance = Math.sqrt((circle1.x - circle2.x) ** 2 + (circle1.y - circle2.y) ** 2);
    const sumOfRadius = circle1.r + circle2.r;
    return (distance < sumOfRadius);
  }
}

// ----------------------------------------------------------------------------------- //
// quadTree関連。
class linearQuadTreeSpace {
  constructor(_width, _height, level){
    this._width = _width;
    this._height = _height;
    this.data = [null];
    this._currentLevel = 0;

    // 入力レベルまでdataを伸長する。
    while(this._currentLevel < level){
      this._expand();
    }
  }

  // dataをクリアする。
  clear() {
    this.data.fill(null);
  }

  // 要素をdataに追加する。
  // 必要なのは、要素と、レベルと、レベル内での番号。
  _addNode(node, level, index){
    // オフセットは(4^L - 1)/3で求まる。
    // それにindexを足せば線形四分木上での位置が出る。
    const offset = ((4 ** level) - 1) / 3;
    const linearIndex = offset + index;

    // もしdataの長さが足りないなら拡張する。
    while(this.data.length <= linearIndex){
      this._expandData();
    }

    // セルの初期値はnullとする。
    // しかし上の階層がnullのままだと面倒が発生する。
    // なので要素を追加する前に親やその先祖すべてを
    // 空配列で初期化する。
    let parentCellIndex = linearIndex;
    while(this.data[parentCellIndex] === null){
      this.data[parentCellIndex] = [];

      parentCellIndex = Math.floor((parentCellIndex - 1) / 4);
      if(parentCellIndex >= this.data.length){
        break;
      }
    }

    // セルに要素を追加する。
    const cell = this.data[linearIndex];
    cell.push(node);
  }

  // Actorを線形四分木に追加する。
  // Actorのコリジョンからモートン番号を計算し、
  // 適切なセルに割り当てる。
  addActor(actor){
    const collider = actor.collider;

    // モートン番号の計算。
    const leftTopMorton = this._calc2DMortonNumber(collider.left, collider.top);
    const rightBottomMorton = this._calc2DMortonNumber(collider.right, collider.bottom);

    // 左上も右下も-1（画面外）であるならば、
    // レベル0として扱う。
    // なおこの処理には気をつける必要があり、
    // 画面外に大量のオブジェクトがあるとレベル0に
    // オブジェクトが大量配置され、当たり判定に大幅な処理時間がかかる。
    // 実用の際にはここをうまく書き換えて、あまり負担のかからない
    // 処理に置き換えるといい。
    if(leftTopMorton === -1 && rightBottomMorton === -1){
      this._addNode(actor, 0, 0);
      return;
    }

    // 左上と右下が同じ番号に所属していたら、
    // それはひとつのセルに収まっているということなので、
    // 特に計算もせずそのまま現在のレベルのセルに入れる。
    if(leftTopMorton === rightBottomMorton){
      this._addNode(actor, this._currentLevel, leftTopMorton);
      return;
    }

    // 左上と右下が異なる番号（＝境界をまたいでいる）の場合、
    // 所属するレベルを計算する。
    const level = this._calcLevel(leftTopMorton, rightBottomMorton);

    // そのレベルでの所属する番号を計算する。
    // モートン番号の代表値として大きい方を採用する。
    // これは片方が-1の場合、-1でない方を採用したいため。
    const larger = Math.max(leftTopMorton, rightBottomMorton);
    const cellNumber = this._calcCell(larger, level);

    // 線形四分木に追加する。
    this._addNode(actor, level, cellNumber);
  }
	addActors(arrayOfArray){
		for(let i = 0; i < arrayOfArray.length; i++){
			let actorArray = arrayOfArray[i];
			for(let k = 0; k < actorArray.length; k++){
				this.addActor(actorArray[k]);
			}
		}
	}

  // 線形四分木の長さを伸ばす。
  _expand(){
    const nextLevel = this._currentLevel + 1;
    const length = ((4 ** (nextLevel + 1)) - 1) / 3;

    while(this.data.length < length) {
      this.data.push(null);
    }

    this._currentLevel++;
  }

  // 16bitの数値を1bit飛ばしの32bitにする。
  _separateBit32(n){
    n = (n|(n<<8)) & 0x00ff00ff;
    n = (n|(n<<4)) & 0x0f0f0f0f;
    n = (n|(n<<2)) & 0x33333333;
    return (n|(n<<1)) & 0x55555555;
  }

  // x, y座標からモートン番号を算出する。
  _calc2DMortonNumber(x, y){
    // 空間の外の場合-1を返す。
    if(x < 0 || y < 0){
      return -1;
    }

    if(x > this._width || y > this._height){
      return -1;
    }

    // 空間の中の位置を求める。
    const xCell = Math.floor(x / (this._width / (2 ** this._currentLevel)));
    const yCell = Math.floor(y / (this._height / (2 ** this._currentLevel)));

    // x位置とy位置をそれぞれ1bit飛ばしの数にし、
    // それらをあわせてひとつの数にする。
    // これがモートン番号となる。
    return (this._separateBit32(xCell) | (this._separateBit32(yCell)<<1));
  }

  // オブジェクトの所属レベルを算出する。
  // XORを取った数を2bitずつ右シフトして、
  // 0でない数が捨てられたときのシフト回数を採用する。
  _calcLevel(leftTopMorton, rightBottomMorton){
    const xorMorton = leftTopMorton ^ rightBottomMorton;
    let level = this._currentLevel - 1;
    let attachedLevel = this._currentLevel;

    for(let i = 0; level >= 0; i++){
      const flag = (xorMorton >> (i * 2)) & 0x3;
      if(flag > 0){
        attachedLevel = level;
      }

      level--;
    }

    return attachedLevel;
  }

  // 階層を求めるときにシフトした数だけ右シフトすれば
  // 空間の位置がわかる。
  _calcCell(morton, level){
    const shift = ((this._currentLevel - level) * 2);
    return morton >> shift;
  }
}


// ----------------------------------------------------------------------------------- //
// player関連。

class player{
	constructor(x, y, speed, life){
		this.x = x;
		this.y = y;
		this.c = {r:0,g:0,b:0};
		this.life = life;
		this.maxLife = life;
		this.active = true;
		this.speed = speed;
		this.shotId = 0;
		this.maxShotId = 3;
		this.bulletCase = [];
		this.span = 0; // 射出間隔
		this.blink = 60; // ブリンク(正の時無敵）
		//this.collider = new circleCollider(0, x, y, 5);
		this.collider = new rectCollider(0, x, y, 8, 8); // グラフィック16x16
	}
	initialize(x, y, speed, life){
		this.x = x;
		this.y = y;
		this.speed = speed;
		this.life = life;
		this.maxLife = life;
		this.active = true;
		this.shotId = 0;
		this.maxShotId = 3;
		this.bulletCase = [];
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
		chargeBullet(this.shotId, this);
		array.push(...this.bulletCase);
		this.bulletCase = [];
		this.span = spanArray[this.shotId];
	}
	move(){
		let d = max(abs(this.x - mouseX), abs(this.y - mouseY));
		if(d < 8){ return; }
		let angle = atan2(mouseY - this.y, mouseX - this.x);
		this.x += this.speed * Math.cos(angle);
		this.y += this.speed * Math.sin(angle);
		this.boundCheck();
	}
	update(){
		if(!this.active){ return; }
		// spanが正なら減らす
		if(this.span > 0){ this.span--; }
		if(this.blink > 0){ this.blink--; }
		if(doubleClickFlag){ this.shotChange(); flagReset(); }
		this.move();
		this.collider.update(this.x, this.y, 8, 8);
	}
	boundCheck(){
		if(this.x < 8){ this.x = 8; }
		else if(this.x > width - 8){ this.x = width - 8; }
		if(this.y < 8){ this.y = 8; }
		else if(this.y > height - 8){ this.y = height - 8; }
	}
	render(){
		if(!this.active){ return; }
		noStroke();
		if(this.blink > 0 && Math.floor(this.blink / 2) % 2 === 0){ return; }
		fill(this.c.r, this.c.g, this.c.b);
		rect(this.x - 8, this.y - 8, 16, 16);
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
		this.active = false;
	}
}

// ----------------------------------------------------------------------------------- //
// enemy, bullet関連

// うごくもの
// (x, y)は長方形の中心、(w, h)は辺の長さの半分。
class mover{
	constructor(x, y, w, h, moveArray, shotArray, r, g, b){
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
		this.c = {r:r, g:g, b:b};
		this.w = w;
		this.h = h;
		this.moveArray = new commandArray(moveArray);
		this.shotArray = new commandArray(shotArray);
		// できればそれに加えて全体の挙動に関するやつをもうひとつ追加したい。HPが0になったら死ぬ、とか。
		// そうやるとHPが0になったときに弾を発射して死ぬとか出来る可能性がある（可能性）。
		this.bulletCase = []; // ここにbulletを放り込んでmasterの方でactiveなものを取りだす流れ。
		// つまりchargeの部分を大幅に書き換える。
		this.active = true;
		this.collider = new rectCollider(-1, x, y, w, h);
	}
  inActivate(){ this.active = false; }
	activate(){ this.active = true; }
	setPos(x, y){ this.x = x; this.y = y; }
	charge(array){
		// fireとかどうでもいい。activeなものを取りだして放り込む。取り出したら排除。
		for(let i = 0; i < this.bulletCase.length; i++){
			let b = this.bulletCase[i];
			if(!b.active){ continue; }
			array.push(b);
			this.bulletCase.splice(i, 1);
		}
	}
	rotateDirection(degree){
		let angle = degree * Math.PI / 180;
		let _vx = this.vx;
		let _vy = this.vy;
		this.vx = _vx * Math.cos(angle) - _vy * Math.sin(angle);
		this.vy = _vy * Math.cos(angle) + _vx * Math.sin(angle);
	}
	boundCheck(){
		if(this.x < this.w || this.x > width - this.w || this.y < this.h || this.y > height - this.h){
			this.active = false;
		}
	}
	act(){
		this.moveArray.execute(this);
		this.shotArray.execute(this);
	}
	update(){
		if(!this.active){ return; }
		this.act();
		this.boundCheck();
		this.collider.update(this.x, this.y, this.w, this.h);
	}
	render(){
	  if(!this.active){ return; }
		fill(this.c.r, this.c.g, this.c.b);
		rect(this.x - this.w, this.y - this.h, this.w * 2, this.h * 2);
		//ellipse(this.x, this.y, this.diam, this.diam);
	}
}

// enemy側からmasterのenemyBulletArrayに放り込むか
class enemy extends mover{
	constructor(x, y, w, h, moveArray, shotArray, r, g, b, life){
		super(x, y, w, h, moveArray, shotArray, r, g, b);
		this.life = life;
		this.maxLife = life;
	}
	hit(obj){
		// 0か2で反応する
		if(obj.collider.id === 0){ return; }
		this.life -= obj.damage;
		if(this.life > 0){ return; }
		this.life = 0;
		this.inActivate();
	}
	render(){
	  if(!this.active){ return; }
		fill(this.c.r, this.c.g, this.c.b);
		rect(this.x - this.w, this.y - this.h, this.w * 2, this.h * 2);
		// HPゲージ。
		fill(150);
		rect(this.x - this.w * 2 - 2, this.y + this.h * 1.5 - 2, this.w * 4 + 4, 9);
		fill(this.c.r, this.c.g, this.c.b);
		rect(this.x - this.w * 2, this.y + this.h * 1.5, this.w * 4 *  this.life / this.maxLife, 5);
	}
}

// enemyの継承でbossを作る。HPが減った時のパターンチェンジなど。
class boss extends enemy{
  constructor(x, y, w, h, moveArray, shotArray, r, g, b, life, patternArray){
		super(x, y, w, h, moveArray, shotArray, r, g, b, life);
		this.patternArray = new commandArray(patternArray);
	}
	act(){
		this.moveArray.execute(this);
		this.shotArray.execute(this);
		this.patternArray.execute(this); // パターンチェンジを司る感じ
	}
}

class bullet extends mover{
  constructor(x, y, w, h, moveArray, shotArray, r, g, b, damage){
		super(x, y, w, h, moveArray, shotArray, r, g, b);
		this.damage = damage;
	}
	hit(obj){
		this.inActivate();
	}
}

// idArray = [0]なら0だけ、[0, 0]なら0が2匹で別の場所、ランダム、以下略
// ループカウンタとかウェイトは同じように
// enemyもいくつか用意してまとめてとかそういう感じの方がいいのかも。
// そうすればenemy配列ひとつで済む。
class enemyGenerator{
  constructor(){
		this.idArray = [];
		this.posArray = [];
		this.generateArray = new commandArray([]);
		this.generate = false;
	}
	reset(){
		this.idArray = [];
		this.posArray = [];
		this.generateArray.setCommand([]);
		this.generate = false;
	}
	setCommand(array){
		this.generateArray.setCommand(array);
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
		this.generateArray.execute(this);
	}
	update(){
		this.act();
	}
}

// ----------------------------------------------------------------------------------- //
// command関連（いずれクラス化）

// 多分こんなの
class commandArray{
	constructor(seq){
		this.seq = seq;
		this.t = 0;
		this.loopCounter = 0;
		this.index = 0;
		this.currentCommand = undefined;
		if(seq.length > 0){ this.currentCommand = seq[0]; }
	}
	setCommand(seq){
		this.seq = seq;
		this.t = 0;
		this.loopCounter = 0;
		this.index = 0;
		if(seq.length > 0){ this.currentCommand = seq[0]; }
	}
	shiftIndex(n){
		this.index += n;
		this.currentCommand = this.seq[this.index];
	}
	setIndex(n){
		this.index = n;
		this.currentCommand = this.seq[this.index];
	}
	inputCommand(seq){
		if(seq.length === 0){ return; }
		this.seq = seq;
		this.currentCommand = this.seq[0];
	}
	execute(obj){
		if(this.seq.length === 0 || this.currentCommand === undefined){ return; }
		this.currentCommand(obj, this);
	}
}

// ----------------------------------------------------------------------------------- //
// command一覧

// 以下、大幅に書き直し。mのところはobj, あとcArray(いずれcommandArrayにする)にしないと。
// メソッド名もいじる。createは長いし意味がないので削る。

function setV(vx, vy){ return (obj, cArray) => {obj.vx = vx; obj.vy = vy; cArray.shiftIndex(1); } }
function setPoleV(v, degree){ return (obj, cArray) => {
	obj.vx = v * Math.cos(degree * Math.PI / 180);
	obj.vy = v * Math.sin(degree * Math.PI / 180);
	cArray.shiftIndex(1);
} }
function setHoming(v){ return (obj, cArray) => {
	let direction = getPlayerDirection(obj.x, obj.y);
	obj.vx = v * Math.cos(direction);
	obj.vy = v * Math.sin(direction);
	cArray.shiftIndex(1);
} }
// (x, y)に向かってぎゅーーん
function setAbsHoming(v, x, y){ return (obj, cArray) => {
	let direction = atan2(y - obj.y, x - obj.x);
	obj.vx = v * Math.cos(direction);
	obj.vy = v * Math.sin(direction);
	cArray.shiftIndex(1);
} }
function straight(obj, cArray){ obj.x += obj.vx; obj.y += obj.vy; }
function accellSum(ax, ay){ return (obj) => {
	obj.vx += ax;
	obj.vy += ay;
	obj.x += obj.vx;
	obj.y += obj.vy;
} }
function accellMulti(ratio){ return (obj) => {
	obj.vx *= ratio;
	obj.vy *= ratio;
	obj.x += obj.vx;
	obj.y += obj.vy;
} }
function straightWithLineBound(a, b, c){ return (obj, cArray) => {
	obj.x += obj.vx; obj.y += obj.vy;
	if(a * obj.x + b * obj.y < c){ return; }
	cArray.shiftIndex(1);
} }
function straightWithCircleBound(x, y, r){ return (obj, cArray) => {
	obj.x += obj.vx; obj.y += obj.vy;
	if(dist(x, y, obj.x, obj.y) < r){ return; }
	cArray.shiftIndex(1);
} }
function rot(degree){ return (obj, cArray) => {
  obj.rotateDirection(degree);
	cArray.shiftIndex(1);
} }
function rotWithLimit(degree, limit){ return (obj, cArray) => {
		cArray.t++;
		obj.rotateDirection(deg);
		obj.x += obj.vx; obj.y += obj.vy;
		if(cArray.t < limit){ return; }
		cArray.t = 0;
		cArray.shiftIndex(1);
} }

// to. 目的地に向かってぎゅーん

// (toX, toY)に向かってspanフレームで到達する
function to(toX, toY, span){ return (obj, cArray) => {
	obj.x = map(cArray.t + 1, cArray.t, span, obj.x, toX);
	obj.y = map(cArray.t + 1, cArray.t, span, obj.y, toY);
	cArray.t++;
	if(cArray.t < span){ return; }
	cArray.t = 0; cArray.shiftIndex(1);
} }
// (toX, toY)に向かってイージングを掛けながらspanフレームで到達する
function toEasing(toX, toY, span, id){ return (obj, cArray) => {
	let prg0 = cArray.t / span;
	let prg1 = (cArray.t + 1) / span;
	obj.x = map(easing(id, prg1), easing(id, prg0), 1, obj.x, toX);
	obj.y = map(easing(id, prg1), easing(id, prg0), 1, obj.y, toY);
	cArray.t++;
	if(cArray.t < span){ return; }
	cArray.t = 0; cArray.shiftIndex(1);
} }

// shiftは相対変化、warpは絶対変化。たとえばピンポイントで0にして、とかいう風に使う。
function jump(n){ return (obj, cArray) => { cArray.shiftIndex(n); } }
function back(n){ return (obj, cArray) => { cArray.shiftIndex(-n); } }
function warp(n){ return (obj, cArray) => { cArray.setIndex(n); } }
function randomWarp(nArray){ return (obj, cArray) => { cArray.setIndex(random(nArray)); } }

// mArrayからsArrayを操作する
function sArrayShift(n){ return (obj, cArray) => {
	obj.shotArray.shiftIndex(n);
	cArray.shiftIndex(1);
} }

// 消滅
function bekilled(obj, cArray){ obj.inActivate(); }

// n個戻すか、先に進めるか。たとえばlimit===2なら2周する感じ。
function shiftLoop(n, limit){ return (obj, cArray) => {
	cArray.loopCounter++;
	if(cArray.loopCounter < limit){ cArray.shiftIndex(-n); } // 無限ループならbackでいい
	else{ cArray.loopCounter = 0; cArray.shiftIndex(1);}
} }
// ループの絶対指定バージョン（使い方に注意、後ろに戻らないとおかしなことになる）
function warpLoop(n, limit){ return (obj, cArray) => {
	cArray.loopCounter++;
	if(cArray.loopCounter < limit){ cArray.setIndex(n); } // 無限ループならbackでいい
	else{ cArray.loopCounter = 0; cArray.shiftIndex(1);}
} }

// spanの方がいいよ。spanだけ何もしない
function wait(span){ return (obj, cArray) => {
	cArray.t++;
	if(cArray.t < span){ return; }
	cArray.t = 0; cArray.shiftIndex(1);
} }

// 敵専用の弾丸チャージメソッド
// 1個だけ放り込む。
function setSingle(id, info = {}){ return (obj, cArray) => {
	chargeBullet(id, obj, info);
	cArray.shiftIndex(1);
} }
// いくつも同じものを放り込む。
function setMulti(id, n, info = {}){ return (obj, cArray) => {
	for(let i = 0; i < n; i++){ chargeBullet(id, obj, info); }
	cArray.shiftIndex(1);
} }

// 敵を作る感じ
function simpleGenerate(idArray, posArray){ return (obj, cArray) => {
	obj.setEnemy(idArray, posArray); cArray.shiftIndex(1);
} }

// 敵専用の弾丸点火メソッド
// indexから始めてn個をactivateする
function fire(index, n){ return (obj, cArray) => {
	for(let i = index; i < index + n; i++){
		let b = obj.bulletCase[i];
		b.setPos(obj.x, obj.y);
		b.activate();
	}
	cArray.shiftIndex(1);
} }

// 全部！
function fireAll(obj){
	obj.bulletCase.forEach((b) => {
		b.setPos(obj.x, obj.y);
		b.activate();
	})
}

// パターンチェンジ
function patternChange(ratio, mIndex, sIndex){ return (obj, cArray) => {
	// HPがMaxのratio以下になるとmとsのIndexをいじる

} }

// ----------------------------------------------------------------------------------- //
// 敵とか弾丸についての関数

// 以下はshotパラメータをいじるための関数
function getEnemy(id, x, y){
	// idによって異なるenemyを作るうえでのデータを返す感じ
	switch(id){
		case 0:
		  return en0(x, y);
		case 1:
		  return en1(x, y);
		case 2:
		  return en2(x, y);
		case 3:
		  return en3(x, y);
		case 100:
		  return en100();
	}
}

// lifeは15. 左に直進しながら自機誘導を連続8発。おわり。
function en0(x, y){
	let mArray = [setV(-2, 0), straight];
	let sArray = [setMulti(128, 8), fire(0, 1), wait(10), shiftLoop(2, 8)]
	return new enemy(x, y, 10, 10, mArray, sArray, 255, 201, 14, 15);
}
// en1, en2, ...作っていく。killedAction = () => {}みたいにすることで
// やられたときにガーン！とかできる。一旦bulletCase = []としてからチャージする感じ。

// lifeは25. 左に直進してからそのまま逆方向に戻っていく。行くときも帰るときも自機誘導連続10発。
function en1(x, y){
	let mArray = [setV(-2, 0), straightWithLineBound(-1, 0, -50), sArrayShift(-4), setV(4, 0), straight];
	let sArray = [setMulti(128, 10), fire(0, 1), wait(10), shiftLoop(2, 10)];
	return new enemy(x, y, 10, 10, mArray, sArray, 255, 127, 39, 25);
}

// lifeは40. その場で自機方向含めて扇状に13発(±60°で10°おき)発射を5回したのち、画面中央を通り越して消滅。
function en2(x, y){
  let mArray = [wait(150), setAbsHoming(6, width / 2, height / 2), accellMulti(1.05)];
	let sArray = [setMulti(129, 5, {start:-60, diff:10, n:13}), fire(0, 13), wait(20), shiftLoop(2, 5)];
	return new enemy(x, y, 20, 20, mArray, sArray, 0, 162, 232, 40);
}

// lifeは150. 右から左ばらまき、ガトリング10発、左から右ばらまき、中心向かってぎゅーん消える
function en3(x, y){
	let mArray = [wait(360), setAbsHoming(6, width / 2, height / 2), accellMulti(1.05)];
	let sArray = [setSingle(129, {start:-60, diff:5, n:25}), setMulti(128, 10)];
	sArray.push(...[setSingle(129, {start:60, diff:-5, n:25}), fire(0, 1), wait(4), shiftLoop(2, 25)]);
	sArray.push(...[wait(10), fire(0, 1), wait(4), shiftLoop(2, 10)]);
	sArray.push(...[wait(10), fire(0, 1), wait(4), shiftLoop(2, 25), wait(10)]);
	sArray.push(...[setV(-5, 0), accellMulti(1.05)]);
	return new enemy(x, y, 20, 20, mArray, sArray, 0, 92, 132, 150);
}

// ちょっと早いけど第一ステージのボス。
function en100(){

}

// バックインで入って誘導弾をばらまきつつぎゅーんとフェードアウト
// 何匹も連続して現れると面白いかも

// ほんとはparamで{id:id, ...}とかしたいけれど。
function chargeBullet(id, obj, info = {}){
	// idによって異なるbulletを作るうえでのデータを返す感じ
	switch(id){
		case 0:
			// 直進
			bl0(obj, info); break;
		case 1:
		  bl1(obj, info); break;
		case 2:
		  bl2(obj, info); break;
		case 128:
			// 自機誘導
			bl128(obj, info); break;
		case 129:
		  // 円形スプレッド
			bl129(obj, info); break;
	}
}

// bl0, bl1, ..., bl128, bl129, ...作っていく。

// 敵の弾は自動制御だからinActivateするけどこっちが撃つ弾はその必要はないので。
// infoにレベルを入れる？それも面白そう。
// 直進弾。
function bl0(obj, info){
	let mArray = [setV(8, 0), straight];
	let b = new bullet(obj.x, obj.y, 6, 4, mArray, [], 0, 0, 0, 5); // ダメージは5.
	b.collider.setId(2);
	obj.bulletCase.push(b);
}
// 5Wayとか、前後に発射とか、前後上下に発射とか面白そう。

// 5Way弾
function bl1(obj, info){
	for(let degree = -30; degree <= 30; degree += 15){
		let mArray = [setPoleV(6, degree), straightWithLineBound(1, 0, obj.x + 100), setV(6, 0), straight];
		let b = new bullet(obj.x, obj.y, 6, 4, mArray, [], 28, 147, 64, 3); // ダメージは3.
		b.collider.setId(2);
		obj.bulletCase.push(b);
	}
}

// 射程短いけどでかくて強いやつ
function bl2(obj, info){
	for(let degree = -30; degree <= 30; degree += 30){
		let mArray = [setPoleV(8, degree), straightWithCircleBound(obj.x, obj.y, 150), bekilled];
		let b = new bullet(obj.x, obj.y, 8, 6, mArray, [], 237, 28, 36, 10); // ダメージは10.
		b.collider.setId(2);
		obj.bulletCase.push(b);
	}
}

// 自機誘導弾。
function bl128(obj, info){
	let mArray = [setHoming(5), straight];
	let b = new bullet(0, 0, 4, 4, mArray, [], 155, 120, 0, 5);
	b.collider.setId(3);
	b.inActivate();
	obj.bulletCase.push(b); // ダメージは5.
}
// 自機の方向からのずれを角度と間隔指定で入れるやつ
function bl129(obj, info){
	let start = info.start; // startからdiff間隔でn個。
	let diff = info.diff;
	let n = info.n;
	for(let i = 0; i < n; i++){
		let degree = start + diff * i;
		let mArray = [setHoming(5), rot(degree), straight];
		let b = new bullet(0, 0, 4, 4, mArray, [], 255, 201, 14, 5);
		b.collider.setId(3);
		b.inActivate();
		obj.bulletCase.push(b); // ダメージは5.
	}
}

// ----------------------------------------------------------------------------------- //
// effect関連

class effect{
	constructor(span){
		this.type = "";
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
		this.typeName = "appear";
		this.enemy = enemy;
		this.x = enemy.x;
		this.y = enemy.y;
		this.w = enemy.w;
		this.h = enemy.h;
		this.c = enemy.c;
	}
	render(){
		fill(this.c.r, this.c.g, this.c.b, 255 * this.count / this.span); // 30くらいを想定
		for(let i = 0; i < 4; i++){
			let angle = Math.PI * 2 * ((12 * i + this.count) / 48);
			let r = (this.w + this.h) * (this.span - this.count) / this.span;
			rect(this.x + r * Math.cos(angle) - this.w, this.y + r * Math.sin(angle) - this.h, this.w * 2, this.h * 2);
		}
	}
}

class simpleVanish extends effect{
	constructor(span, obj){
		super(span);
		this.typeName = "vanish";
		this.x = obj.x;
		this.y = obj.y;
		this.c = obj.c;
		this.diam = 2 * Math.sqrt(obj.w * obj.w + obj.h * obj.h);
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

// ----------------------------------------------------------------------------------- //
// utility.

// すべてのあれに何か同じことをさせる汎用関数（everyUpdate, everyRender, etc）
function every(arrayOfArray, actName){
	arrayOfArray.forEach((array) => { array.forEach((obj) => { obj[actName](); }) })
}

// (x, y)からプレイヤーへの方向をラジアンで取得する関数
function getPlayerDirection(x, y){
	let p = all.currentState.player;
	return atan2(p.y - y, p.x - x);
}

// イージング
function easing(id, x){
	switch(id){
		case 0: // ノーマル
			return x;
		case 1: // slowIn fastOut
			return x * x;
		case 2: // backIn fastOut
			return x * (2 * x - 1);
		case 3: // slowIn slowOut
			return (1 - Math.cos(Math.PI * x)) / 2;
		case 4: // slowIn veryFastOut
		  return 1 - pow(1 - x * x, 0.5);
		case 5: // backIn backOut
		  return (50 / 23) * (-2 * pow(x, 3) + 3 * pow(x, 2) - 0.54 * x);
		case 6: // verySlowIn
		  return 3 * pow(x, 4) - 2 * pow(x, 6);
		case 7: // backIn backOut
		  return -12 * pow(x, 3) + 18 * pow(x, 2) - 5 * x;
		case 8: // fastIn QuadSlowOut
		  return (7 / 8) + (x / 8) - (7 / 8) * pow(1 - x, 4);
		case 9: // QuadSlowIn fastOut
		  return (x / 8) + (7 / 8) * pow(x, 4);
		case 10: // waving
		  return x + 0.1 * sin(8 * PI * x);
		case 11: // middle stop
		  return (1 - pow(cos(PI * x), 5)) / 2;
	}
}
