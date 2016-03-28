import {isArray} from './util/isArray';
import {isObject} from './util/isObject';
import {isFunction} from './util/isFunction';
import {tryCatch} from './util/tryCatch';
import {errorObject} from './util/errorObject';

// Subscription is an abstract interfaces indicates that "Subscription can have an 'unsubscription callback' and can be unsubscribed from. Also Subscriptions can added/removed to each other."
// Implementation tells that Subscription conforms to Composite pattern: calling unsubscribe leads to executing of all the unsubscibe callbacks contained in the child subscriptions. 

// Example: 

// Subscription0 <- callback0 <- client
// - Subscription1 <- callback1 <-|
// - Subscription2 <- callback2 <-|

//  function client() {
//    Subscription root = new Subscription(function callback0() { console.log('root callback called back') }) 
//    root.add(function callback1() { console.log('callback1 called back') })
//    root.add(function callback2() { console.log('callback2 called back') })
//    root.unsubscribe()
//  }

// > root callback called back 
// > callback1 called back
// > callback2 called back
// (Order is implementation-dependent)

export class Subscription {
  
  // "Empty" subscription. Why it is "empty"? I only see that it can't be unsubscribed from.  
  public static EMPTY: Subscription = (function(empty: any){
    empty.isUnsubscribed = true;
    return empty;
  }(new Subscription()));

  public isUnsubscribed: boolean = false;

  constructor(_unsubscribe?: () => void) {
    if (_unsubscribe) {
      (<any> this)._unsubscribe = _unsubscribe;
    }
  }

  unsubscribe(): void {
    let hasErrors = false;
    let errors: any[];

    if (this.isUnsubscribed) {
      return;
    }

    this.isUnsubscribed = true;

    const { _unsubscribe, _subscriptions } = (<any> this);

    (<any> this)._subscriptions = null;

    if (isFunction(_unsubscribe)) {
      let trial = tryCatch(_unsubscribe).call(this);
      if (trial === errorObject) {
        hasErrors = true;
        (errors = errors || []).push(errorObject.e);
      }
    }

    if (isArray(_subscriptions)) {

      let index = -1;
      const len = _subscriptions.length;

      while (++index < len) {
        const sub = _subscriptions[index];
        if (isObject(sub)) {
          let trial = tryCatch(sub.unsubscribe).call(sub);
          if (trial === errorObject) {
            hasErrors = true;
            errors = errors || [];
            let err = errorObject.e;
            if (err instanceof UnsubscriptionError) {
              errors = errors.concat(err.errors);
            } else {
              errors.push(err);
            }
          }
        }
      }
    }

    if (hasErrors) {
      throw new UnsubscriptionError(errors);
    }
  }

  add(subscription: Subscription | Function | void): void {
    // return early if the parameter is: 
    //  1. null/undefined/0/''
    //  2. this subscription itself
    //  3. the static `empty` Subscription
    if (!subscription || (
        subscription === this) || (
        subscription === Subscription.EMPTY)) {
      return;
    }

    let sub = (<Subscription> subscription);

    switch (typeof subscription) {
      case 'function':
        sub = new Subscription(<(() => void) > subscription);
      case 'object':
        if (sub.isUnsubscribed || typeof sub.unsubscribe !== 'function') {
          break;
        } else if (this.isUnsubscribed) {
          sub.unsubscribe();
        } else {
          ((<any> this)._subscriptions || ((<any> this)._subscriptions = [])).push(sub);
        }
        break;
      default:
        throw new Error('Unrecognized subscription ' + subscription + ' added to Subscription.');
    }
  }

  remove(subscription: Subscription): void {

    // return early if the parameter is: 
    //  1. null/undefined/0/''
    //  2. this subscription itself
    //  3. the static `empty` Subscription
    if (subscription == null   || (
        subscription === this) || (
        subscription === Subscription.EMPTY)) {
      return;
    }

    const subscriptions = (<any> this)._subscriptions;

    if (subscriptions) {
      const subscriptionIndex = subscriptions.indexOf(subscription);
      if (subscriptionIndex !== -1) {
        subscriptions.splice(subscriptionIndex, 1);
      }
    }
  }
}

export class UnsubscriptionError extends Error {
  constructor(public errors: any[]) {
    super('unsubscriptoin error(s)');
    this.name = 'UnsubscriptionError';
  }
}
