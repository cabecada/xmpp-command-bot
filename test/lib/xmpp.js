'use strict';

var proxyquire = require('proxyquire')
  , Events = require('events').EventEmitter
  , ltx = require('node-xmpp-core').ltx
  , should = require('should')

Events.prototype.send = function(stanza) {
    this.emit('send', stanza.root())
}

var Commander = function() {}
Commander.prototype.handle = function(command, callback) {
    this.lastCommand = command
    callback('Server has been up a long time')
}
Commander.prototype.getLastCommand = function() {
    return this.lastCommand
}

var Xmpp = proxyquire(
    '../../lib/xmpp',
    {
        'node-xmpp-client': Events,
        './commander': Commander
    }
)

/*jshint -W030 */
describe('Xmpp', function() {
  
    describe('Connecting', function() {
      
        it('Throws exception when can not connect', function(done) {
            var xmpp = null
            try {
                xmpp = new Xmpp({ xmpp: { connection: {} } })
                xmpp.getClient().emit('error', 'could not connect')
            } catch (e) {
                e.message.should.equal(xmpp.COULD_NOT_CONNECT)
                done()
            }
        })
        
        it('Uses a different error after connecting', function(done) {
            var xmpp = null
            try {
                xmpp = new Xmpp({ xmpp: { connection: {} } })
                xmpp.getClient().emit('online')
                xmpp.getClient().emit('error', 'could not connect')
            } catch (e) {
                e.message.should.equal(xmpp.SERVER_WENT_AWAY)
                done()
            }
        })
        
        it('Sends presence after connecting', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {}
                }
            })
            xmpp.getClient().on('send', function(stanza) {
                stanza.is('presence').should.be.true
                stanza.getChildText('show').should.equal('chat')
                done()
            })
            xmpp.getClient().emit('online')
        })
        
    })
    
    describe('Joining MUC', function() {
        
        var joinError = ltx.parse('<presence ' +
           'from="chat@localhost" ' +
           'id="273hs51g" ' +
           'to="hag66@shakespeare.lit/pda" ' +
           'type="error">' +
           '<error by="coven@chat.shakespeare.lit" type="modify">' +
            '<jid-malformed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>' +
            '</error></presence>') 

        var botLeave = ltx.parse('<presence ' +
           'from="chat@localhost" ' +
           'id="273hs51g" ' +
           'to="hag66@shakespeare.lit/pda" ' +
           'type="unavailable"/>') 
        
        it('Errors if no room provided', function(done) {
            var xmpp = null
            try {
                xmpp = new Xmpp({
                    xmpp: {
                        connection: {},
                        muc: {
                            server: 'localhost',
                            nick: 'commander'
                        }
                    }
                })
                xmpp.getClient().emit('online')
            } catch (e) {
                e.message.should.equal(xmpp.MUC_MISSING_ROOM)
                done()
            }
        })
        
        it('Errors if no server provided', function(done) {
            var xmpp = null
            try {
                xmpp = new Xmpp({
                    xmpp: {
                        connection: {},
                        muc: {
                            room: 'test',
                            nick: 'commander'
                        }
                    }
                })
                xmpp.getClient().emit('online')
            } catch (e) {
                e.message.should.equal(xmpp.MUC_MISSING_SERVER)
                done()
            }
        })
        
        it('Errors if no nick provided', function(done) {
            var xmpp = null
            try {
                xmpp = new Xmpp({
                    xmpp: {
                        connection: {},
                        muc: {
                            room: 'test',
                            server: 'localhost'
                        }
                    }
                })
                xmpp.getClient().emit('online')
            } catch (e) {
                e.message.should.equal(xmpp.MUC_MISSING_NICK)
                done()
            }
        })
        
        it('Attempts to join a MUC', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'chat',
                        server: 'localhost',
                        nick: 'commander'
                    }
                }
            })
            xmpp.getClient().on('send', function(stanza) {
                stanza.is('presence').should.be.true
                if (stanza.attrs.to !== 'chat@localhost/commander')  return
                done()
            })
            xmpp.getClient().emit('online')
        })
        
        it('Attempts to join MUC with password', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'chat',
                        server: 'localhost',
                        nick: 'commander',
                        password: 'letmein'
                    }
                }
            })
            xmpp.getClient().on('send', function(stanza) {
                stanza.is('presence').should.be.true
                if (stanza.attrs.to !== 'chat@localhost/commander') return
                stanza.getChild('x', xmpp.NS_MUC)
                    .getChildText('password')
                    .should.equal('letmein')
                 done()
            })
            xmpp.getClient().emit('online')
        })
        
        it('Handles unsuccessful join', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'chat',
                        server: 'localhost',
                        nick: 'commander',
                        password: 'letmein'
                    }
                }
            })
            var sendError = function() {
                try {
                    xmpp.getClient().emit('stanza', joinError)
                } catch (e) {
                    e.message.should.containEql(xmpp.MUC_JOIN_FAIL)
                    e.message.should.containEql('jid-malformed')
                    done()
                }
            }
            xmpp.getClient().on('send', function(stanza) {
                stanza.is('presence').should.be.true
                if (stanza.attrs.to !== 'chat@localhost/commander') return
                stanza.getChild('x', xmpp.NS_MUC)
                    .getChildText('password')
                    .should.equal('letmein')
                sendError()
            })
            xmpp.getClient().emit('online')
        })
        
        it('Ignores messages from other rooms', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'chat',
                        server: 'localhost',
                        nick: 'commander',
                        password: 'letmein'
                    }
                }
            })
            var sendError = function() {
                try {
                    joinError.attrs.from = 'chat@domain'
                    xmpp.getClient().emit('stanza', joinError)
                    done()
                } catch (e) {
                    e.message.should.containEql(xmpp.MUC_JOIN_FAIL)
                    e.message.should.containEql('jid-malformed')
                    done('Should not have thrown exception')
                }
            }
            xmpp.getClient().on('send', function(stanza) {
                stanza.is('presence').should.be.true
                if (stanza.attrs.to !== 'chat@localhost/commander') return
                stanza.attrs.to
                    .should.equal('chat@localhost/commander')
                stanza.getChild('x', xmpp.NS_MUC)
                    .getChildText('password')
                    .should.equal('letmein')
                sendError()
            })
            xmpp.getClient().emit('online')
        })
        
        
        it('Errors when bot leaves room', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'chat',
                        server: 'localhost',
                        nick: 'commander',
                        password: 'letmein'
                    }
                }
            })
            var sendError = function() {
                try {
                    xmpp.getClient().emit('stanza', botLeave)
                } catch (e) {
                    e.message.should.containEql(xmpp.MUC_BOT_LEFT)
                    done()
                }
            }
            xmpp.getClient().on('send', function(stanza) {
                stanza.is('presence').should.be.true
                if (stanza.attrs.to !== 'chat@localhost/commander') return
                stanza.getChild('x', xmpp.NS_MUC)
                    .getChildText('password')
                    .should.equal('letmein')
                sendError()
            })
            xmpp.getClient().emit('online')
        })
        
    })
    
    describe('Chat messages', function() {
            
        var chatMessage = null
        
        beforeEach(function() {
            chatMessage = ltx.parse(
                '<message from="lloyd@localhost/laptop" type="chat">' +
                '<body>uptime</body>' +
                '</message>'
            )
        })
      
        it('Accepts message from directly allowed user', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    admins: [
                        'lloyd@localhost'
                    ]
                } 
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            xmpp.getCommander().getLastCommand().should.equal('uptime')
            done()
        })
      
        it('Accepts message from regex matched user', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    admins: [
                        'fail@localhost',
                        /lloyd.*/
                    ]
                } 
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            xmpp.getCommander().getLastCommand()
                .should.equal('uptime')
            done()
        })
    
        it('Accepts message from function matched user', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    admins: [
                        'fail@localhost',
                        /lloyd@[^localhost]/,
                        function(stanza, context) {
                            stanza.should.exist
                            context.should.exist
                            return true
                        }
                    ]
                } 
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            xmpp.getCommander().getLastCommand()
                .should.equal('uptime')
            done()
        })
        
        it('Errors to disallowed user', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    admins: [
                        function() {
                            return false
                        }
                    ]
                } 
            })
            xmpp.getClient().on('send', function(stanza) {
                if (stanza.is('presence')) return
                stanza.is('message').should.be.true
                stanza.attrs.to
                    .should.equal('lloyd@localhost/laptop')
                stanza.getChildText('body')
                    .should.equal(xmpp.PERMISSION_DENIED)
                done()  
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            var lastCommand = xmpp.getCommander().getLastCommand()
            should.not.exist(lastCommand)
        })
        
        it('Sends response', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    admins: [
                        function() {
                            return true
                        }
                    ]
                } 
            })
            xmpp.getClient().on('send', function(stanza) {
                if (stanza.is('presence')) return
                stanza.is('message').should.be.true
                stanza.attrs.to.toString()
                    .should.equal('lloyd@localhost/laptop')
                stanza.getChildText('body')
                    .should.equal('Server has been up a long time')
                done()  
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            xmpp.getCommander().getLastCommand().should.equal('uptime')
        })
        
    })
    
    describe('Chat message', function() {

        it('Sends response to groupchat message', function(done) {
            var chatMessage = ltx.parse(
                '<message from="room@localhost/user" type="groupchat">' +
                '<body>bot: uptime</body>' +
                '</message>'
            )
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'room',
                        server: 'localhost',
                        nick: 'bot'
                    },
                    admins: [
                        function() {
                            return true
                        }
                    ]
                } 
            })
            xmpp.getClient().on('send', function(stanza) {
                if (stanza.is('presence')) return
                stanza.is('message').should.be.true
                stanza.attrs.to.toString()
                    .should.equal('room@localhost')
                stanza.attrs.type.should.equal('groupchat')
                stanza.getChildText('body')
                    .should.equal('Server has been up a long time')
                done()  
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            xmpp.getCommander().getLastCommand().should.equal('uptime')
        })
        
        it('Sends response to private message', function(done) {
            var chatMessage = ltx.parse(
                '<message from="room@localhost/user" type="chat">' +
                '<body>bot: uptime</body>' +
                '</message>'
            )
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'room',
                        server: 'localhost',
                        nick: 'bot'
                    },
                    admins: [
                        function() {
                            return true
                        }
                    ]
                } 
            })
            xmpp.getClient().on('send', function(stanza) {
                if (stanza.is('presence')) return
                stanza.is('message').should.be.true
                stanza.attrs.to.toString()
                    .should.equal('room@localhost/user')
                stanza.attrs.type.should.equal('chat')
                stanza.getChildText('body')
                    .should.equal('Server has been up a long time')
                done()  
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            xmpp.getCommander().getLastCommand().should.equal('uptime')
        })
        
        it('Does not respond to messages not for it', function(done) {
            var chatMessage = ltx.parse(
                '<message from="room@localhost/user" type="chat">' +
                '<body>uptime</body>' +
                '</message>'
            )
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'room',
                        server: 'localhost',
                        nick: 'bot'
                    },
                    admins: [
                        function() {
                            return true
                        }
                    ]
                } 
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            var lastCommand = xmpp.getCommander().getLastCommand()
            should.not.exist(lastCommand)
            done()
        })
        
    })
    
    describe('Presence subscriptions', function() {
    
        it('Automatically agrees to presence subscription requests', function(done) {
            var subscriptionRequest = ltx.parse(
                '<presence from="test@localhost/laptop" type="subscribe" />'   
            )
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {}
                } 
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().on('send', function(stanza) {
                if (!stanza.is('presence')) return
                if (stanza.attrs.type !== 'subscribed') return
                stanza.attrs.to.should.equal('test@localhost')
                done()  
            })
            xmpp.getClient().emit('stanza', subscriptionRequest)
        })
        
    })
    
    describe('MUC role restrictions', function() {
      
        it('Ignores message from user without appropriate role', function(done) {
            var chatMessage = ltx.parse(
                '<message from="room@localhost/user" type="groupchat">' +
                '<body>bot: uptime</body>' +
                '</message>'
            )
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'room',
                        server: 'localhost',
                        nick: 'bot',
                        roles: [ 'admin', 'moderator' ]
                    },
                    admins: [
                        function() {
                            return true
                        }
                    ]
                } 
            })
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            var lastCommand = xmpp.getCommander().getLastCommand()
            should.not.exist(lastCommand)
            done()                  
        })
        
        it('Accepts a message for an allowed user', function(done) {
            var chatMessage = ltx.parse(
                '<message from="room@localhost/user" type="groupchat">' +
                '<body>bot: uptime</body>' +
                '</message>'
            )
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    muc: {
                        room: 'room',
                        server: 'localhost',
                        nick: 'bot',
                        roles: [ 'admin', 'moderator' ]
                    },
                    admins: [
                        function() {
                            return true
                        }
                    ]
                } 
            })
            var presence = ltx.parse(
                '<presence from="room@localhost/user">' +
                '<x xmlns="' + xmpp.NS_MUC_USER + '">' +
                '<item role="admin"/>' +
                '</x>' +
                '</presence>'
            )
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', presence)
            xmpp.getClient().emit('stanza', chatMessage)
            var lastCommand = xmpp.getCommander().getLastCommand()
            lastCommand.should.equal('uptime')
            done() 
        })
        
    })

    describe('Issues', function() {

        it('Issue #18: Ignores chat state notifications', function(done) {
            var xmpp = new Xmpp({
                xmpp: {
                    connection: {},
                    admins: [
                        'lloyd@localhost'
                    ]
                }
            })
            var chatMessage = ltx.parse(
                '<message from="lloyd@localhost/laptop" type="chat">' +
                '<composing xmlns="http://jabber.org/protocol/chatstates"/>' +
                '</message>'
            )
            xmpp.getClient().emit('online')
            xmpp.getClient().emit('stanza', chatMessage)
            should.not.exist(xmpp.getCommander().getLastCommand())
            done()
        })

    })
})
