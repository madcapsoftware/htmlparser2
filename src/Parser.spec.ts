import { describe, it, expect, vi } from "vitest";
import { Parser, Tokenizer } from "./index.js";
import type { Handler } from "./Parser.js";

describe("API", () => {
    it("should work without callbacks", () => {
        const cbs: Partial<Handler> = { onerror: vi.fn() };
        const p = new Parser(cbs, {
            xmlMode: true,
            lowerCaseAttributeNames: true,
        });

        p.end("<a foo><bar></a><!-- --><![CDATA[]]]><?foo?><!bar><boo/>boohay");
        p.write("foo");

        // Check for an error
        p.end();
        p.write("foo");
        expect(cbs.onerror).toHaveBeenLastCalledWith(
            new Error(".write() after done!"),
        );
        p.end();
        expect(cbs.onerror).toHaveBeenLastCalledWith(
            new Error(".end() after done!"),
        );

        // Should ignore the error if there is no callback
        delete cbs.onerror;
        p.write("foo");

        p.reset();

        // Remove method
        cbs.onopentag = vi.fn();
        p.write("<a foo");
        delete cbs.onopentag;
        p.write(">");

        // Pause/resume
        const onText = vi.fn();
        cbs.ontext = onText;
        p.pause();
        p.write("foo");
        expect(onText).not.toHaveBeenCalled();
        p.resume();
        expect(onText).toHaveBeenLastCalledWith("foo");
        p.pause();
        expect(onText).toHaveBeenCalledTimes(1);
        p.resume();
        expect(onText).toHaveBeenCalledTimes(1);
        p.pause();
        p.end("bar");
        expect(onText).toHaveBeenCalledTimes(1);
        p.resume();
        expect(onText).toHaveBeenCalledTimes(2);
        expect(onText).toHaveBeenLastCalledWith("bar");
    });

    it("should back out of numeric entities (#125)", () => {
        const onend = vi.fn();
        let text = "";
        const p = new Parser({
            ontext(data) {
                text += data;
            },
            onend,
        });

        p.end("id=770&#anchor");

        expect(onend).toHaveBeenCalledTimes(1);
        expect(text).toBe("id=770&#anchor");

        p.reset();
        text = "";

        p.end("0&#xn");

        expect(onend).toHaveBeenCalledTimes(2);
        expect(text).toBe("0&#xn");
    });

    it("should not have the start index be greater than the end index", () => {
        const onopentag = vi.fn();
        const onclosetag = vi.fn();

        const p = new Parser({
            onopentag(tag) {
                expect(p.startIndex).toBeLessThanOrEqual(p.endIndex);
                onopentag(tag, p.startIndex, p.endIndex);
            },
            onclosetag(tag) {
                expect(p.startIndex).toBeLessThanOrEqual(p.endIndex);
                onclosetag(tag, p.endIndex);
            },
        });

        p.write("<p>");

        expect(onopentag).toHaveBeenLastCalledWith("p", 0, 2);
        expect(onclosetag).not.toHaveBeenCalled();

        p.write("Foo");

        p.write("<hr>");

        expect(onopentag).toHaveBeenLastCalledWith("hr", 6, 9);
        expect(onclosetag).toHaveBeenCalledTimes(2);
        expect(onclosetag).toHaveBeenNthCalledWith(1, "p", 9);
        expect(onclosetag).toHaveBeenNthCalledWith(2, "hr", 9);
    });

    it("should update the position when a single tag is spread across multiple chunks", () => {
        let called = false;
        const p = new Parser({
            onopentag() {
                called = true;
                expect(p.startIndex).toBe(0);
                expect(p.endIndex).toBe(12);
            },
        });

        p.write("<div ");
        p.write("foo=bar>");

        expect(called).toBe(true);
    });

    it("should have the correct position for implied opening tags", () => {
        let called = false;
        const p = new Parser({
            onopentag() {
                called = true;
                expect(p.startIndex).toBe(0);
                expect(p.endIndex).toBe(3);
            },
        });

        p.write("</p>");
        expect(called).toBe(true);
    });

    it("should parse <__proto__> (#387)", () => {
        const p = new Parser(null);

        // Should not throw
        p.parseChunk("<__proto__>");
    });

    it("should support custom tokenizer", () => {
        class CustomTokenizer extends Tokenizer {}

        const p = new Parser(
            {
                onparserinit(parser: Parser) {
                    // @ts-expect-error Accessing private tokenizer here
                    expect(parser.tokenizer).toBeInstanceOf(CustomTokenizer);
                },
            },
            { Tokenizer: CustomTokenizer },
        );
        p.done();
    });

    describe("should throw when missing a closing tag", () => {
        describe("non-void tag", () => {
            describe("without sibling", () => {
                describe("at end of markup", () => {
                    it("with only an opening tag", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div>")).toThrowError("Closing tag is missing");
                    });
    
                    it("with closing tag with no name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div></")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag with wrong name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div></aaa>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag missing gt", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div></div")).toThrowError("Closing tag is missing");
                    });
                });
    
                describe("within valid parent", () => {
                    it("with only an opening tag", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></div>")).toThrowError("Closing tag is missing",);
                    });
    
                    it("with closing tag with no name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></</div>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag with wrong name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></aaa></div>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag missing gt", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></h1</div>")).toThrowError("Closing tag is missing");
                    });
                });
            });

            describe("with sibling", () => {
                describe("at end of markup", () => {
                    it("with only an opening tag", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div> <h2></h2>")).toThrowError("Closing tag is missing");
                    });
    
                    it("with closing tag with no name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div></ <h2></h2>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag with wrong name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div></aaa> <h2></h2>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag missing gt", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div></div <h2></h2>")).toThrowError("Closing tag is missing");
                    });
                });
    
                describe("within valid parent", () => {
                    it("with only an opening tag", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1> <h2></h2></div>")).toThrowError("Closing tag is missing",);
                    });
    
                    it("with closing tag with no name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></ <h2></h2></div>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag with wrong name", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></aaa> <h2></h2></div>")).toThrowError("Closing tag is missing");
                    });
        
                    it("with closing tag missing gt", () => {
                        const p = new Parser(null, {
                            strictMode: true,
                        });
        
                        expect(() => p.end("<div><h1></h1 <h2></h2></div>")).toThrowError("Closing tag is missing");
                    });
                });
            });
        });

        it("for void tag", () => {
            const p = new Parser(null, {
                strictMode: true,
            });

            expect(() => p.end("<img>")).toThrowError("Closing tag is missing");
        });

        it("for void tag not at end of markup", () => {
            const p = new Parser(null, {
                strictMode: true,
            });

            expect(() => p.end("<div><img></div>")).toThrowError(
                "Closing tag is missing",
            );
        });

        it("for br tag", () => {
            const p = new Parser(null, {
                strictMode: true,
            });

            expect(() => p.end("<br>")).toThrowError("Closing tag is missing");
        });

        it("for br tag not at end of markup", () => {
            const p = new Parser(null, {
                strictMode: true,
            });

            expect(() => p.end("<div><br></div>")).toThrowError(
                "Closing tag is missing",
            );
        });
    });

    describe("should not throw for a self closing tag", () => {
        it("for non-void tag", () => {
            const p = new Parser(null, {
                strictMode: true,
                recognizeSelfClosing: true,
            });

            expect(() => p.end("<div />")).not.toThrowError();
        });

        it("for non-void tag not at end of markup", () => {
            const p = new Parser(null, {
                strictMode: true,
                recognizeSelfClosing: true,
            });

            expect(() => p.end("<div><h1 /></div>")).not.toThrowError();
        });

        it("for void tag", () => {
            const p = new Parser(null, {
                strictMode: true,
                recognizeSelfClosing: true,
            });

            expect(() => p.end("<img />")).not.toThrowError();
        });

        it("for void tag not at end of markup", () => {
            const p = new Parser(null, {
                strictMode: true,
                recognizeSelfClosing: true,
            });

            expect(() => p.end("<div><img /></div>")).not.toThrowError();
        });

        it("for br tag", () => {
            const p = new Parser(null, {
                strictMode: true,
                recognizeSelfClosing: true,
            });

            expect(() => p.end("<br />")).not.toThrowError();
        });

        it("for br tag not at end of markup", () => {
            const p = new Parser(null, {
                strictMode: true,
                recognizeSelfClosing: true,
            });

            expect(() => p.end("<div><br /></div>")).not.toThrowError();
        });
    });
});
